import ELKModule from "elkjs";
import type { ELK, ElkNode, ElkExtendedEdge } from "elkjs";
import type {
  OrmGraph,
  GraphNode,
  FactTypeNode,
  ConstraintNode,
} from "../graph/GraphTypes.js";
import type {
  PositionedGraph,
  PositionedNode,
  PositionedObjectTypeNode,
  PositionedFactTypeNode,
  PositionedConstraintNode,
  PositionedRoleBox,
  PositionedEdge,
  PositionedConstraintEdge,
  PositionedSubtypeEdge,
  Position,
} from "./LayoutTypes.js";
import {
  ROLE_BOX_WIDTH,
  ROLE_BOX_HEIGHT,
  OT_MIN_WIDTH,
  OT_HEIGHT,
  CONSTRAINT_RADIUS,
} from "../render/theme.js";

// elkjs has CJS/ESM interop quirks: the default export may be the
// constructor directly or wrapped in a `.default` property.
const ELKConstructor = (
  typeof ELKModule === "function"
    ? ELKModule
    : (ELKModule as unknown as { default: new () => ELK }).default
) as unknown as new () => ELK;

let elkInstance: ELK | undefined;
function getElk(): ELK {
  if (!elkInstance) {
    elkInstance = new ELKConstructor();
  }
  return elkInstance;
}

/**
 * Use ELK.js to compute positions for all nodes and edges in the graph.
 *
 * ELK handles the automatic layout (node placement, edge routing) so that
 * the diagram is readable without manual positioning.
 */
export async function layoutGraph(graph: OrmGraph): Promise<PositionedGraph> {
  const elkGraph = buildElkGraph(graph);
  const laid = await getElk().layout(elkGraph);

  return extractPositions(graph, laid);
}

/**
 * Reorder graph nodes so that connected object types are adjacent and
 * fact types appear near their connected entities. This gives ELK's
 * `considerModelOrder` option a better starting order for crossing
 * minimization.
 *
 * Algorithm:
 * 1. Build adjacency between object types (two OTs are adjacent if they
 *    share at least one fact type).
 * 2. Greedy ordering: start with the highest-degree object type, then
 *    repeatedly append the unplaced OT most connected to already-placed OTs.
 * 3. Order fact types by the average position of their connected OTs.
 * 4. Constraint nodes retain their relative order at the end.
 */
/** @internal Exported for testing only. */
export function sortNodesByConnectivity(graph: OrmGraph): readonly GraphNode[] {
  const objectTypes: GraphNode[] = [];
  const factTypes: GraphNode[] = [];
  const constraintNodes: GraphNode[] = [];

  for (const node of graph.nodes) {
    if (node.kind === "object_type") objectTypes.push(node);
    else if (node.kind === "fact_type") factTypes.push(node);
    else constraintNodes.push(node);
  }

  // If there are fewer than 3 object types, ordering doesn't matter.
  if (objectTypes.length < 3) {
    return graph.nodes;
  }

  // Map each fact type to the set of object type ids it connects to.
  const ftToOts = new Map<string, Set<string>>();
  for (const ft of factTypes) {
    if (ft.kind !== "fact_type") continue;
    const otIds = new Set<string>();
    for (const role of (ft as FactTypeNode).roles) {
      otIds.add(role.playerId);
    }
    ftToOts.set(ft.id, otIds);
  }

  // Build OT-OT adjacency: two OTs are adjacent if they share a fact type.
  const otAdjacency = new Map<string, Map<string, number>>();
  for (const ot of objectTypes) {
    otAdjacency.set(ot.id, new Map());
  }
  for (const otIds of ftToOts.values()) {
    const arr = [...otIds];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]!;
        const b = arr[j]!;
        const adjA = otAdjacency.get(a);
        const adjB = otAdjacency.get(b);
        if (adjA) adjA.set(b, (adjA.get(b) ?? 0) + 1);
        if (adjB) adjB.set(a, (adjB.get(a) ?? 0) + 1);
      }
    }
  }

  // Greedy ordering: start with the highest-degree OT, then pick the
  // unplaced OT with the most connections to already-placed OTs.
  const placed = new Set<string>();
  const orderedOts: GraphNode[] = [];
  const otById = new Map<string, GraphNode>();
  for (const ot of objectTypes) otById.set(ot.id, ot);

  // Seed: pick the OT with the most distinct neighbors.
  let bestSeed = objectTypes[0]!;
  let bestDegree = 0;
  for (const ot of objectTypes) {
    const deg = otAdjacency.get(ot.id)?.size ?? 0;
    if (deg > bestDegree) {
      bestDegree = deg;
      bestSeed = ot;
    }
  }
  orderedOts.push(bestSeed);
  placed.add(bestSeed.id);

  while (orderedOts.length < objectTypes.length) {
    let bestCandidate: GraphNode | undefined;
    let bestScore = -1;

    for (const ot of objectTypes) {
      if (placed.has(ot.id)) continue;
      // Score = total edge weight to already-placed OTs.
      let score = 0;
      const adj = otAdjacency.get(ot.id);
      if (adj) {
        for (const [neighborId, weight] of adj) {
          if (placed.has(neighborId)) score += weight;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = ot;
      }
    }

    if (!bestCandidate) {
      // Remaining OTs are disconnected; append in original order.
      for (const ot of objectTypes) {
        if (!placed.has(ot.id)) {
          orderedOts.push(ot);
          placed.add(ot.id);
        }
      }
      break;
    }

    orderedOts.push(bestCandidate);
    placed.add(bestCandidate.id);
  }

  // Build a position index for the ordered OTs.
  const otPosition = new Map<string, number>();
  for (let i = 0; i < orderedOts.length; i++) {
    otPosition.set(orderedOts[i]!.id, i);
  }

  // Sort fact types by the average position of their connected OTs.
  const sortedFts = [...factTypes].sort((a, b) => {
    const aOts = ftToOts.get(a.id);
    const bOts = ftToOts.get(b.id);
    const avgA = averagePosition(aOts, otPosition);
    const avgB = averagePosition(bOts, otPosition);
    return avgA - avgB;
  });

  return [...orderedOts, ...sortedFts, ...constraintNodes];
}

function averagePosition(
  otIds: Set<string> | undefined,
  otPosition: Map<string, number>,
): number {
  if (!otIds || otIds.size === 0) return Infinity;
  let sum = 0;
  let count = 0;
  for (const id of otIds) {
    const pos = otPosition.get(id);
    if (pos !== undefined) {
      sum += pos;
      count++;
    }
  }
  return count > 0 ? sum / count : Infinity;
}

function buildElkGraph(graph: OrmGraph): ElkNode {
  const children: ElkNode[] = [];
  const edges: ElkExtendedEdge[] = [];

  const sortedNodes = sortNodesByConnectivity(graph);

  for (const node of sortedNodes) {
    if (node.kind === "object_type") {
      // Estimate width from name length.
      const labelWidth = Math.max(OT_MIN_WIDTH, node.name.length * 9 + 40);
      children.push({
        id: node.id,
        width: labelWidth,
        height: OT_HEIGHT,
      });
    } else if (node.kind === "fact_type") {
      // Fact type node: width is the sum of role boxes.
      const ftWidth = node.roles.length * ROLE_BOX_WIDTH;
      const ftHeight = ROLE_BOX_HEIGHT;

      // Each role is a port on the fact type node.
      const ports = node.roles.map((role, i) => ({
        id: role.roleId,
        width: 1,
        height: 1,
        // Place port at the center of each role box.
        x: i * ROLE_BOX_WIDTH + ROLE_BOX_WIDTH / 2,
        y: ftHeight / 2,
      }));

      children.push({
        id: node.id,
        width: ftWidth,
        height: ftHeight,
        ports,
        layoutOptions: {
          "org.eclipse.elk.portConstraints": "FIXED_POS",
        },
      });
    } else {
      // Constraint node: small circle.
      const diameter = CONSTRAINT_RADIUS * 2;
      children.push({
        id: node.id,
        width: diameter,
        height: diameter,
      });
    }
  }

  for (const edge of graph.edges) {
    edges.push({
      id: `${edge.sourceNodeId}--${edge.roleId}`,
      sources: [edge.sourceNodeId],
      targets: [edge.roleId],
    });
  }

  // Constraint edges connect constraint nodes to role ports on fact type nodes.
  for (const ce of graph.constraintEdges) {
    edges.push({
      id: `constraint:${ce.constraintNodeId}--${ce.roleId}`,
      sources: [ce.constraintNodeId],
      targets: [ce.roleId],
    });
  }

  // Subtype edges connect object type nodes directly (subtype -> supertype).
  for (const se of graph.subtypeEdges) {
    edges.push({
      id: `subtype:${se.subtypeNodeId}--${se.supertypeNodeId}`,
      sources: [se.subtypeNodeId],
      targets: [se.supertypeNodeId],
    });
  }

  return {
    id: "root",
    layoutOptions: {
      "org.eclipse.elk.algorithm": "layered",
      "org.eclipse.elk.direction": "DOWN",
      "org.eclipse.elk.spacing.nodeNode": "60",
      "org.eclipse.elk.spacing.edgeNode": "30",
      "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "org.eclipse.elk.padding": "[top=40,left=40,bottom=40,right=40]",
      // Crossing minimization: sweep layers from both sides with greedy
      // post-processing for fewer edge crossings.
      "org.eclipse.elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "org.eclipse.elk.layered.crossingMinimization.greedySwitch.type":
        "TWO_SIDED",
      // Thoroughness controls how many iterations the crossing minimization
      // and other heuristics run. Default is 7; 40 produces noticeably
      // better layouts for ORM diagrams without meaningful perf cost.
      "org.eclipse.elk.layered.thoroughness": "40",
      // Network simplex node placement minimizes total edge length, pulling
      // connected nodes closer together within their layer.
      "org.eclipse.elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "org.eclipse.elk.layered.nodePlacement.networkSimplex.nodeFlexibility.default":
        "NODE_SIZE_WHERE_SPACE_PERMITS",
      // Use the input node order as a hint for initial layer ordering. This
      // works together with the connectivity-based pre-sort in buildElkGraph.
      "org.eclipse.elk.layered.considerModelOrder.strategy":
        "NODES_AND_EDGES",
    },
    children,
    edges,
  };
}

function extractPositions(
  graph: OrmGraph,
  laid: ElkNode,
): PositionedGraph {
  const nodeMap = new Map<string, ElkNode>();
  for (const child of laid.children ?? []) {
    nodeMap.set(child.id, child);
  }

  const positionedNodes: PositionedNode[] = [];

  for (const node of graph.nodes) {
    const elkNode = nodeMap.get(node.id);
    const x = elkNode?.x ?? 0;
    const y = elkNode?.y ?? 0;
    const width = elkNode?.width ?? 0;
    const height = elkNode?.height ?? 0;

    if (node.kind === "object_type") {
      const posNode: PositionedObjectTypeNode = {
        kind: "object_type",
        id: node.id,
        name: node.name,
        objectTypeKind: node.objectTypeKind,
        referenceMode: node.referenceMode,
        x,
        y,
        width,
        height,
      };
      positionedNodes.push(posNode);
    } else if (node.kind === "fact_type") {
      const ftNode = node as FactTypeNode;
      const roles: PositionedRoleBox[] = ftNode.roles.map((role, i) => ({
        roleId: role.roleId,
        roleName: role.roleName,
        playerName: role.playerName,
        hasUniqueness: role.hasUniqueness,
        isMandatory: role.isMandatory,
        frequencyMin: role.frequencyMin,
        frequencyMax: role.frequencyMax,
        x: i * ROLE_BOX_WIDTH,
        y: 0,
        width: ROLE_BOX_WIDTH,
        height: ROLE_BOX_HEIGHT,
      }));

      const posNode: PositionedFactTypeNode = {
        kind: "fact_type",
        id: node.id,
        name: node.name,
        roles,
        hasSpanningUniqueness: ftNode.hasSpanningUniqueness,
        ringConstraint: ftNode.ringConstraint,
        isObjectified: ftNode.isObjectified,
        objectifiedEntityName: ftNode.objectifiedEntityName,
        x,
        y,
        width,
        height,
      };
      positionedNodes.push(posNode);
    } else {
      const cNode = node as ConstraintNode;
      const posNode: PositionedConstraintNode = {
        kind: "constraint",
        id: cNode.id,
        constraintKind: cNode.constraintKind,
        roleIds: cNode.roleIds,
        supersetRoleIds: cNode.supersetRoleIds,
        x,
        y,
        width,
        height,
      };
      positionedNodes.push(posNode);
    }
  }

  // Extract edge routing points from ELK.
  const positionedEdges: PositionedEdge[] = [];
  for (const edge of graph.edges) {
    const elkEdge = (laid.edges ?? []).find(
      (e) => e.id === `${edge.sourceNodeId}--${edge.roleId}`,
    );

    let points: Position[] = [];
    if (elkEdge && "sections" in elkEdge) {
      const sections = (elkEdge as { sections?: Array<{
        startPoint: Position;
        endPoint: Position;
        bendPoints?: Position[];
      }> }).sections;
      if (sections && sections[0]) {
        const section = sections[0];
        points = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ];
      }
    }

    // Fallback: straight line from source center to target port.
    if (points.length === 0) {
      const sourceElk = nodeMap.get(edge.sourceNodeId);
      const targetElk = nodeMap.get(edge.targetNodeId);
      if (sourceElk && targetElk) {
        points = [
          {
            x: (sourceElk.x ?? 0) + (sourceElk.width ?? 0) / 2,
            y: (sourceElk.y ?? 0) + (sourceElk.height ?? 0) / 2,
          },
          {
            x: (targetElk.x ?? 0) + (targetElk.width ?? 0) / 2,
            y: (targetElk.y ?? 0) + (targetElk.height ?? 0) / 2,
          },
        ];
      }
    }

    positionedEdges.push({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      roleId: edge.roleId,
      points,
    });
  }

  // Extract subtype edge routing points from ELK.
  const positionedSubtypeEdges: PositionedSubtypeEdge[] = [];
  for (const se of graph.subtypeEdges) {
    const elkEdgeId = `subtype:${se.subtypeNodeId}--${se.supertypeNodeId}`;
    const elkEdge = (laid.edges ?? []).find((e) => e.id === elkEdgeId);

    let points: Position[] = [];
    if (elkEdge && "sections" in elkEdge) {
      const sections = (elkEdge as { sections?: Array<{
        startPoint: Position;
        endPoint: Position;
        bendPoints?: Position[];
      }> }).sections;
      if (sections && sections[0]) {
        const section = sections[0];
        points = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ];
      }
    }

    // Fallback: straight line between node centers.
    if (points.length === 0) {
      const sourceElk = nodeMap.get(se.subtypeNodeId);
      const targetElk = nodeMap.get(se.supertypeNodeId);
      if (sourceElk && targetElk) {
        points = [
          {
            x: (sourceElk.x ?? 0) + (sourceElk.width ?? 0) / 2,
            y: (sourceElk.y ?? 0) + (sourceElk.height ?? 0) / 2,
          },
          {
            x: (targetElk.x ?? 0) + (targetElk.width ?? 0) / 2,
            y: (targetElk.y ?? 0) + (targetElk.height ?? 0) / 2,
          },
        ];
      }
    }

    positionedSubtypeEdges.push({
      subtypeNodeId: se.subtypeNodeId,
      supertypeNodeId: se.supertypeNodeId,
      providesIdentification: se.providesIdentification,
      points,
    });
  }

  // Extract constraint edge routing points from ELK.
  const positionedConstraintEdges: PositionedConstraintEdge[] = [];
  for (const ce of graph.constraintEdges) {
    const elkEdgeId = `constraint:${ce.constraintNodeId}--${ce.roleId}`;
    const elkEdge = (laid.edges ?? []).find((e) => e.id === elkEdgeId);

    let points: Position[] = [];
    if (elkEdge && "sections" in elkEdge) {
      const sections = (elkEdge as { sections?: Array<{
        startPoint: Position;
        endPoint: Position;
        bendPoints?: Position[];
      }> }).sections;
      if (sections && sections[0]) {
        const section = sections[0];
        points = [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ];
      }
    }

    // Fallback: straight line between node centers.
    if (points.length === 0) {
      const sourceElk = nodeMap.get(ce.constraintNodeId);
      const targetElk = nodeMap.get(ce.factTypeNodeId);
      if (sourceElk && targetElk) {
        points = [
          {
            x: (sourceElk.x ?? 0) + (sourceElk.width ?? 0) / 2,
            y: (sourceElk.y ?? 0) + (sourceElk.height ?? 0) / 2,
          },
          {
            x: (targetElk.x ?? 0) + (targetElk.width ?? 0) / 2,
            y: (targetElk.y ?? 0) + (targetElk.height ?? 0) / 2,
          },
        ];
      }
    }

    positionedConstraintEdges.push({
      constraintNodeId: ce.constraintNodeId,
      factTypeNodeId: ce.factTypeNodeId,
      roleId: ce.roleId,
      points,
    });
  }

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    constraintEdges: positionedConstraintEdges,
    subtypeEdges: positionedSubtypeEdges,
    width: laid.width ?? 800,
    height: laid.height ?? 600,
  };
}
