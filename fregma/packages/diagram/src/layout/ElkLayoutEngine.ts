import ELKModule from "elkjs";
import type { ELK, ElkNode, ElkExtendedEdge } from "elkjs";
import type { OrmGraph, FactTypeNode } from "../graph/GraphTypes.js";
import type {
  PositionedGraph,
  PositionedNode,
  PositionedObjectTypeNode,
  PositionedFactTypeNode,
  PositionedRoleBox,
  PositionedEdge,
  PositionedSubtypeEdge,
  Position,
} from "./LayoutTypes.js";
import { ROLE_BOX_WIDTH, ROLE_BOX_HEIGHT, OT_MIN_WIDTH, OT_HEIGHT } from "../render/theme.js";

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

function buildElkGraph(graph: OrmGraph): ElkNode {
  const children: ElkNode[] = [];
  const edges: ElkExtendedEdge[] = [];

  for (const node of graph.nodes) {
    if (node.kind === "object_type") {
      // Estimate width from name length.
      const labelWidth = Math.max(OT_MIN_WIDTH, node.name.length * 9 + 40);
      children.push({
        id: node.id,
        width: labelWidth,
        height: OT_HEIGHT,
      });
    } else {
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
    }
  }

  for (const edge of graph.edges) {
    edges.push({
      id: `${edge.sourceNodeId}--${edge.roleId}`,
      sources: [edge.sourceNodeId],
      targets: [edge.roleId],
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
    } else {
      const ftNode = node as FactTypeNode;
      const roles: PositionedRoleBox[] = ftNode.roles.map((role, i) => ({
        roleId: role.roleId,
        roleName: role.roleName,
        playerName: role.playerName,
        hasUniqueness: role.hasUniqueness,
        isMandatory: role.isMandatory,
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

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    subtypeEdges: positionedSubtypeEdges,
    width: laid.width ?? 800,
    height: laid.height ?? 600,
  };
}
