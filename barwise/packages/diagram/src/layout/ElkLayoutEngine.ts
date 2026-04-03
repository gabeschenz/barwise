import ELKModule from "elkjs";
import type { ELK, ElkExtendedEdge, ElkNode } from "elkjs";
import type { ConstraintNode, FactTypeNode, OrmGraph } from "../graph/GraphTypes.js";
import {
  CONSTRAINT_RADIUS,
  FACT_TYPE_COLLISION_PADDING,
  FACT_TYPE_STACK_GAP,
  FONT_SIZE_ALIAS,
  OT_ALIAS_LINE_HEIGHT,
  OT_HEIGHT,
  OT_MIN_WIDTH,
  ROLE_BOX_HEIGHT,
  ROLE_BOX_WIDTH,
  UNARY_STUB_LENGTH,
} from "../render/theme.js";
import type {
  FactTypeOrientation,
  Position,
  PositionedConstraintEdge,
  PositionedConstraintNode,
  PositionedEdge,
  PositionedFactTypeNode,
  PositionedGraph,
  PositionedNode,
  PositionedObjectTypeNode,
  PositionedRoleBox,
  PositionedSubtypeEdge,
} from "./LayoutTypes.js";

// elkjs has CJS/ESM interop quirks: the default export may be the
// constructor directly or wrapped in a `.default` property.
const ELKConstructor = (
  typeof ELKModule === "function"
    ? ELKModule
    : (ELKModule as unknown as { default: new() => ELK; }).default
) as unknown as new() => ELK;

let elkInstance: ELK | undefined;
function getElk(): ELK {
  if (!elkInstance) {
    elkInstance = new ELKConstructor();
  }
  return elkInstance;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Use a two-pass layout to produce an entity-centric ORM diagram.
 *
 * Pass 1: Position entity types using ELK stress algorithm.
 * Pass 2: Place fact types geometrically between their connected entities.
 */
export async function layoutGraph(graph: OrmGraph): Promise<PositionedGraph> {
  // Pass 1: entity-only layout via ELK stress.
  const elkGraph = buildEntityElkGraph(graph);
  const laid = await getElk().layout(elkGraph);
  const entityPositions = extractEntityPositions(graph, laid);

  // Post-adjust: enforce supertype above subtype.
  enforceSubtypeOrdering(entityPositions, graph.subtypeEdges);

  // Post-adjust: arrange subtype fans in arcs.
  arrangeSubtypeFans(entityPositions, graph.subtypeEdges);

  // Pass 2: place fact types between their connected entities.
  const factTypePositions = placeFactTypes(graph, entityPositions);

  // Place constraint nodes near connected roles.
  const constraintPositions = placeConstraintNodes(graph, entityPositions, factTypePositions);

  // Collision resolution.
  const allPositioned = [
    ...entityPositions.values(),
    ...factTypePositions.values(),
    ...constraintPositions.values(),
  ];
  resolveOverlaps(allPositioned);

  // Build positioned nodes array.
  const positionedNodes: PositionedNode[] = [];
  for (const node of graph.nodes) {
    if (node.kind === "object_type") {
      const pos = entityPositions.get(node.id);
      if (pos) positionedNodes.push(pos);
    } else if (node.kind === "fact_type") {
      const pos = factTypePositions.get(node.id);
      if (pos) positionedNodes.push(pos);
    } else {
      const pos = constraintPositions.get(node.id);
      if (pos) positionedNodes.push(pos);
    }
  }

  // Route edges.
  const positionedEdges = routeRoleEdges(graph, entityPositions, factTypePositions);
  const positionedConstraintEdges = routeConstraintEdges(graph, constraintPositions, factTypePositions);
  const positionedSubtypeEdges = routeSubtypeEdges(graph, entityPositions);

  // Compute bounding box.
  const { width, height } = computeBounds(positionedNodes, positionedEdges, positionedSubtypeEdges);

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    constraintEdges: positionedConstraintEdges,
    subtypeEdges: positionedSubtypeEdges,
    width,
    height,
  };
}

// ---------------------------------------------------------------------------
// Pass 1: Entity-only ELK graph with stress algorithm
// ---------------------------------------------------------------------------

/** @internal Exported for testing. */
export function buildEntityElkGraph(graph: OrmGraph): ElkNode {
  const children: ElkNode[] = [];
  const edges: ElkExtendedEdge[] = [];

  // Collect entity type node IDs.
  const entityIds = new Set<string>();
  for (const node of graph.nodes) {
    if (node.kind === "object_type") {
      entityIds.add(node.id);
      let labelWidth = Math.max(OT_MIN_WIDTH, node.name.length * 9 + 40);
      const hasAliases = node.aliases !== undefined && node.aliases.length > 0;
      if (hasAliases) {
        const aliasText = `(a.k.a. ${node.aliases!.map((a) => `'${a}'`).join(", ")})`;
        const aliasWidth = aliasText.length * FONT_SIZE_ALIAS * 0.6 + 40;
        labelWidth = Math.max(labelWidth, aliasWidth);
      }
      const height = hasAliases ? OT_HEIGHT + OT_ALIAS_LINE_HEIGHT : OT_HEIGHT;
      children.push({ id: node.id, width: labelWidth, height });
    }
  }

  // Derive synthetic edges from fact types: if two entities share a
  // fact type, create an edge between them. Weight reflects the number
  // of shared fact types.
  const edgeWeights = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.kind !== "fact_type") continue;
    const ft = node as FactTypeNode;
    const playerIds = [...new Set(ft.roles.map((r) => r.playerId))].filter((id) => entityIds.has(id));

    const arity = playerIds.length;
    const weight = arity <= 2 ? 1 : 0.5;

    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const key = [playerIds[i], playerIds[j]].sort().join("--");
        edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + weight);
      }
    }
  }

  // Subtype edges also create entity-entity connections.
  for (const se of graph.subtypeEdges) {
    const key = [se.subtypeNodeId, se.supertypeNodeId].sort().join("--");
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
  }

  let edgeId = 0;
  for (const [key, _weight] of edgeWeights) {
    const [sourceId, targetId] = key.split("--");
    edges.push({
      id: `synth-${edgeId++}`,
      sources: [sourceId!],
      targets: [targetId!],
    });
  }

  return {
    id: "root",
    layoutOptions: {
      "org.eclipse.elk.algorithm": "stress",
      "org.eclipse.elk.stress.desiredEdgeLength": "200",
      "org.eclipse.elk.spacing.nodeNode": "120",
      "org.eclipse.elk.padding": "[top=60,left=60,bottom=60,right=60]",
      "org.eclipse.elk.stress.epsilon": "0.001",
      "org.eclipse.elk.stress.iterationLimit": "300",
    },
    children,
    edges,
  };
}

function extractEntityPositions(
  graph: OrmGraph,
  laid: ElkNode,
): Map<string, PositionedObjectTypeNode> {
  const nodeMap = new Map<string, ElkNode>();
  for (const child of laid.children ?? []) {
    nodeMap.set(child.id, child);
  }

  const positions = new Map<string, PositionedObjectTypeNode>();
  for (const node of graph.nodes) {
    if (node.kind !== "object_type") continue;
    const elkNode = nodeMap.get(node.id);
    positions.set(node.id, {
      kind: "object_type",
      id: node.id,
      name: node.name,
      objectTypeKind: node.objectTypeKind,
      referenceMode: node.referenceMode,
      aliases: node.aliases,
      annotations: node.annotations,
      x: elkNode?.x ?? 0,
      y: elkNode?.y ?? 0,
      width: elkNode?.width ?? OT_MIN_WIDTH,
      height: elkNode?.height ?? OT_HEIGHT,
    });
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Subtype ordering and fan arrangement
// ---------------------------------------------------------------------------

interface MutablePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

function enforceSubtypeOrdering(
  entityPositions: Map<string, PositionedObjectTypeNode>,
  subtypeEdges: readonly { subtypeNodeId: string; supertypeNodeId: string }[],
): void {
  const MIN_VERTICAL_GAP = 80;

  for (const se of subtypeEdges) {
    const superPos = entityPositions.get(se.supertypeNodeId);
    const subPos = entityPositions.get(se.subtypeNodeId);
    if (!superPos || !subPos) continue;

    // Supertype should be above subtype (lower y value).
    const superBottom = superPos.y + superPos.height;
    if (superBottom + MIN_VERTICAL_GAP > subPos.y) {
      // Push subtype down.
      const newY = superBottom + MIN_VERTICAL_GAP;
      entityPositions.set(se.subtypeNodeId, { ...subPos, y: newY });
    }
  }
}

function arrangeSubtypeFans(
  entityPositions: Map<string, PositionedObjectTypeNode>,
  subtypeEdges: readonly { subtypeNodeId: string; supertypeNodeId: string }[],
): void {
  // Group subtypes by supertype.
  const fanMap = new Map<string, string[]>();
  for (const se of subtypeEdges) {
    let arr = fanMap.get(se.supertypeNodeId);
    if (!arr) {
      arr = [];
      fanMap.set(se.supertypeNodeId, arr);
    }
    arr.push(se.subtypeNodeId);
  }

  const ARC_RADIUS = 180;
  const ARC_ANGLE_RANGE = Math.PI * 0.75; // 135 degrees

  for (const [supertypeId, subtypeIds] of fanMap) {
    if (subtypeIds.length < 2) continue;

    const superPos = entityPositions.get(supertypeId);
    if (!superPos) continue;

    const superCenterX = superPos.x + superPos.width / 2;
    const superBottom = superPos.y + superPos.height;

    // Arrange subtypes in an arc below the supertype.
    // Arc goes from -arcAngle/2 to +arcAngle/2 relative to straight down.
    const n = subtypeIds.length;
    const startAngle = Math.PI / 2 - ARC_ANGLE_RANGE / 2; // measured from right (0 = right, PI/2 = down)
    const angleStep = n > 1 ? ARC_ANGLE_RANGE / (n - 1) : 0;

    for (let i = 0; i < n; i++) {
      const subPos = entityPositions.get(subtypeIds[i]!);
      if (!subPos) continue;

      const angle = startAngle + i * angleStep;
      const cx = superCenterX + ARC_RADIUS * Math.cos(angle);
      const cy = superBottom + ARC_RADIUS * Math.sin(angle);

      entityPositions.set(subtypeIds[i]!, {
        ...subPos,
        x: cx - subPos.width / 2,
        y: cy - subPos.height / 2,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 2: Geometric fact type placement
// ---------------------------------------------------------------------------

function placeFactTypes(
  graph: OrmGraph,
  entityPositions: Map<string, PositionedObjectTypeNode>,
): Map<string, PositionedFactTypeNode> {
  const positions = new Map<string, PositionedFactTypeNode>();

  // Group fact types by their entity pair (for stacking).
  const pairGroups = new Map<string, FactTypeNode[]>();

  for (const node of graph.nodes) {
    if (node.kind !== "fact_type") continue;
    const ft = node as FactTypeNode;
    const playerIds = [...new Set(ft.roles.map((r) => r.playerId))];

    if (playerIds.length === 2) {
      const key = [...playerIds].sort().join("--");
      let group = pairGroups.get(key);
      if (!group) {
        group = [];
        pairGroups.set(key, group);
      }
      group.push(ft);
    }
  }

  for (const node of graph.nodes) {
    if (node.kind !== "fact_type") continue;
    const ft = node as FactTypeNode;
    const playerIds = [...new Set(ft.roles.map((r) => r.playerId))];
    const arity = playerIds.length;

    let cx: number;
    let cy: number;
    let orientation: FactTypeOrientation;

    if (arity === 0) {
      // Degenerate: no connected entities.
      cx = 0;
      cy = 0;
      orientation = "horizontal";
    } else if (arity === 1 && playerIds[0] === playerIds[playerIds.length - 1]) {
      // Check if truly unary (1 role) or reflexive (2+ roles same player).
      const isReflexive = ft.roles.length >= 2;

      const entityPos = entityPositions.get(playerIds[0]!);
      if (!entityPos) {
        cx = 0;
        cy = 0;
        orientation = "horizontal";
      } else if (isReflexive) {
        // Reflexive: place adjacent to entity, offset below-right.
        cx = entityPos.x + entityPos.width + UNARY_STUB_LENGTH + ROLE_BOX_HEIGHT / 2;
        cy = entityPos.y + entityPos.height / 2;
        orientation = "vertical";
      } else {
        // Unary: single role box on a stub.
        cx = entityPos.x + entityPos.width + UNARY_STUB_LENGTH + ROLE_BOX_WIDTH / 2;
        cy = entityPos.y + entityPos.height / 2;
        orientation = "horizontal";
      }
    } else if (arity === 2) {
      // Binary: midpoint between two entities.
      const posA = entityPositions.get(playerIds[0]!);
      const posB = entityPositions.get(playerIds[1]!);
      if (!posA || !posB) {
        cx = 0;
        cy = 0;
        orientation = "horizontal";
      } else {
        const ax = posA.x + posA.width / 2;
        const ay = posA.y + posA.height / 2;
        const bx = posB.x + posB.width / 2;
        const by = posB.y + posB.height / 2;
        cx = (ax + bx) / 2;
        cy = (ay + by) / 2;

        const dx = Math.abs(bx - ax);
        const dy = Math.abs(by - ay);
        orientation = dx >= dy ? "horizontal" : "vertical";

        // Handle stacking for multiple fact types between same pair.
        const pairKey = [...playerIds].sort().join("--");
        const group = pairGroups.get(pairKey);
        if (group && group.length > 1) {
          const idx = group.indexOf(ft);
          const total = group.length;
          const stackOffset = (idx - (total - 1) / 2) * (ROLE_BOX_HEIGHT + FACT_TYPE_STACK_GAP);

          if (orientation === "horizontal") {
            // Stack perpendicular to horizontal axis = vertically.
            cy += stackOffset;
          } else {
            // Stack perpendicular to vertical axis = horizontally.
            cx += stackOffset;
          }
        }
      }
    } else {
      // Ternary+: centroid of connected entities.
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const pid of playerIds) {
        const pos = entityPositions.get(pid);
        if (!pos) continue;
        const ecx = pos.x + pos.width / 2;
        const ecy = pos.y + pos.height / 2;
        sumX += ecx;
        sumY += ecy;
        minX = Math.min(minX, ecx);
        maxX = Math.max(maxX, ecx);
        minY = Math.min(minY, ecy);
        maxY = Math.max(maxY, ecy);
        count++;
      }

      if (count > 0) {
        cx = sumX / count;
        cy = sumY / count;
        orientation = (maxX - minX) >= (maxY - minY) ? "horizontal" : "vertical";
      } else {
        cx = 0;
        cy = 0;
        orientation = "horizontal";
      }
    }

    // Compute dimensions and role box positions based on orientation.
    const roleCount = ft.roles.length;
    let ftWidth: number;
    let ftHeight: number;
    const roles: PositionedRoleBox[] = [];

    if (orientation === "horizontal") {
      ftWidth = roleCount * ROLE_BOX_WIDTH;
      ftHeight = ROLE_BOX_HEIGHT;
      for (let i = 0; i < roleCount; i++) {
        const role = ft.roles[i]!;
        roles.push({
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
        });
      }
    } else {
      ftWidth = ROLE_BOX_HEIGHT; // swapped
      ftHeight = roleCount * ROLE_BOX_WIDTH; // swapped
      for (let i = 0; i < roleCount; i++) {
        const role = ft.roles[i]!;
        roles.push({
          roleId: role.roleId,
          roleName: role.roleName,
          playerName: role.playerName,
          hasUniqueness: role.hasUniqueness,
          isMandatory: role.isMandatory,
          frequencyMin: role.frequencyMin,
          frequencyMax: role.frequencyMax,
          x: 0,
          y: i * ROLE_BOX_WIDTH,
          width: ROLE_BOX_HEIGHT, // swapped
          height: ROLE_BOX_WIDTH, // swapped
        });
      }
    }

    const ftX = cx - ftWidth / 2;
    const ftY = cy - ftHeight / 2;

    positions.set(ft.id, {
      kind: "fact_type",
      id: ft.id,
      name: ft.name,
      roles,
      hasSpanningUniqueness: (ft as FactTypeNode).hasSpanningUniqueness,
      ringConstraint: (ft as FactTypeNode).ringConstraint,
      isObjectified: (ft as FactTypeNode).isObjectified,
      objectifiedEntityName: (ft as FactTypeNode).objectifiedEntityName,
      annotations: (ft as FactTypeNode).annotations,
      orientation,
      x: ftX,
      y: ftY,
      width: ftWidth,
      height: ftHeight,
    });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Constraint node placement
// ---------------------------------------------------------------------------

function placeConstraintNodes(
  graph: OrmGraph,
  entityPositions: Map<string, PositionedObjectTypeNode>,
  factTypePositions: Map<string, PositionedFactTypeNode>,
): Map<string, PositionedConstraintNode> {
  const positions = new Map<string, PositionedConstraintNode>();

  // Build a lookup from roleId to its absolute position.
  const roleAbsolutePos = new Map<string, Position>();
  for (const ft of factTypePositions.values()) {
    for (const role of ft.roles) {
      roleAbsolutePos.set(role.roleId, {
        x: ft.x + role.x + role.width / 2,
        y: ft.y + role.y + role.height / 2,
      });
    }
  }

  for (const node of graph.nodes) {
    if (node.kind !== "constraint") continue;
    const cn = node as ConstraintNode;

    const allRoleIds = [...cn.roleIds, ...(cn.supersetRoleIds ?? [])];
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const roleId of allRoleIds) {
      const pos = roleAbsolutePos.get(roleId);
      if (pos) {
        sumX += pos.x;
        sumY += pos.y;
        count++;
      }
    }

    const diameter = CONSTRAINT_RADIUS * 2;
    let cx: number;
    let cy: number;

    if (count > 0) {
      cx = sumX / count;
      cy = sumY / count;

      // Offset perpendicular to the line between first two roles.
      if (allRoleIds.length >= 2) {
        const p1 = roleAbsolutePos.get(allRoleIds[0]!);
        const p2 = roleAbsolutePos.get(allRoleIds[1]!);
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            // Perpendicular offset.
            const perpX = -dy / len * 30;
            const perpY = dx / len * 30;
            cx += perpX;
            cy += perpY;
          }
        }
      }
    } else {
      cx = 0;
      cy = 0;
    }

    positions.set(cn.id, {
      kind: "constraint",
      id: cn.id,
      constraintKind: cn.constraintKind,
      roleIds: cn.roleIds,
      supersetRoleIds: cn.supersetRoleIds,
      x: cx - diameter / 2,
      y: cy - diameter / 2,
      width: diameter,
      height: diameter,
    });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Collision resolution
// ---------------------------------------------------------------------------

interface BoundingBox {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function resolveOverlaps(nodes: PositionedNode[]): void {
  const MAX_ITERATIONS = 3;
  const PAD = FACT_TYPE_COLLISION_PADDING;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let moved = false;

    // Build padded bounding boxes.
    const boxes: BoundingBox[] = nodes.map((n) => ({
      nodeId: n.id,
      x: n.x - PAD,
      y: n.y - PAD,
      width: n.width + 2 * PAD,
      height: n.height + 2 * PAD,
    }));

    // Sort by x for efficient sweep.
    boxes.sort((a, b) => a.x - b.x);

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;

        // If b starts beyond a's right edge, no more overlaps for a.
        if (b.x > a.x + a.width) break;

        // Check vertical overlap.
        if (a.y + a.height <= b.y || b.y + b.height <= a.y) continue;

        // Overlap detected. Compute MTV.
        const overlapX = Math.min(a.x + a.width - b.x, b.x + b.width - a.x);
        const overlapY = Math.min(a.y + a.height - b.y, b.y + b.height - a.y);

        // Find the actual nodes and nudge them.
        const nodeA = nodes.find((n) => n.id === a.nodeId);
        const nodeB = nodes.find((n) => n.id === b.nodeId);
        if (!nodeA || !nodeB) continue;

        const mutableA = nodeA as unknown as MutablePosition;
        const mutableB = nodeB as unknown as MutablePosition;

        if (overlapX < overlapY) {
          // Separate horizontally.
          const halfX = overlapX / 2 + 1;
          mutableA.x -= halfX;
          mutableB.x += halfX;
        } else {
          // Separate vertically.
          const halfY = overlapY / 2 + 1;
          mutableA.y -= halfY;
          mutableB.y += halfY;
        }
        moved = true;
      }
    }

    if (!moved) break;
  }
}

// ---------------------------------------------------------------------------
// Edge routing
// ---------------------------------------------------------------------------

function entityCenter(pos: PositionedObjectTypeNode): Position {
  return { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
}

function roleCenter(ft: PositionedFactTypeNode, role: PositionedRoleBox): Position {
  return { x: ft.x + role.x + role.width / 2, y: ft.y + role.y + role.height / 2 };
}

/**
 * Compute where a ray from `from` to `to` intersects a rounded rectangle
 * defined by x, y, width, height.
 */
function rectBorderIntersection(
  from: Position,
  to: Position,
  rect: { x: number; y: number; width: number; height: number },
): Position {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const hw = rect.width / 2;
  const hh = rect.height / 2;

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  // Scale factors to hit each edge.
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * Compute where a ray from `from` to `to` intersects an ellipse
 * centered at cx, cy with radii rx, ry.
 */
function ellipseBorderIntersection(
  from: Position,
  to: Position,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): Position {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const angle = Math.atan2(dy, dx);
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  };
}

function entityBorderPoint(
  entity: PositionedObjectTypeNode,
  target: Position,
): Position {
  const center = entityCenter(entity);
  if (entity.objectTypeKind === "value") {
    // Value types are ellipses.
    return ellipseBorderIntersection(
      center,
      target,
      center.x,
      center.y,
      entity.width / 2,
      entity.height / 2,
    );
  }
  return rectBorderIntersection(center, target, entity);
}

function routeRoleEdges(
  graph: OrmGraph,
  entityPositions: Map<string, PositionedObjectTypeNode>,
  factTypePositions: Map<string, PositionedFactTypeNode>,
): PositionedEdge[] {
  const edges: PositionedEdge[] = [];

  for (const edge of graph.edges) {
    const entityPos = entityPositions.get(edge.sourceNodeId);
    const ftPos = factTypePositions.get(edge.targetNodeId);
    if (!entityPos || !ftPos) continue;

    const role = ftPos.roles.find((r) => r.roleId === edge.roleId);
    if (!role) continue;

    const rc = roleCenter(ftPos, role);
    const ep = entityBorderPoint(entityPos, rc);

    edges.push({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      roleId: edge.roleId,
      points: [ep, rc],
    });
  }

  return edges;
}

function routeConstraintEdges(
  graph: OrmGraph,
  constraintPositions: Map<string, PositionedConstraintNode>,
  factTypePositions: Map<string, PositionedFactTypeNode>,
): PositionedConstraintEdge[] {
  const edges: PositionedConstraintEdge[] = [];

  // Build role lookup.
  const roleLookup = new Map<string, { ft: PositionedFactTypeNode; role: PositionedRoleBox }>();
  for (const ft of factTypePositions.values()) {
    for (const role of ft.roles) {
      roleLookup.set(role.roleId, { ft, role });
    }
  }

  for (const ce of graph.constraintEdges) {
    const cnPos = constraintPositions.get(ce.constraintNodeId);
    if (!cnPos) continue;

    const roleInfo = roleLookup.get(ce.roleId);
    if (!roleInfo) continue;

    const cnCenter: Position = {
      x: cnPos.x + cnPos.width / 2,
      y: cnPos.y + cnPos.height / 2,
    };
    const rc = roleCenter(roleInfo.ft, roleInfo.role);

    edges.push({
      constraintNodeId: ce.constraintNodeId,
      factTypeNodeId: ce.factTypeNodeId,
      roleId: ce.roleId,
      points: [cnCenter, rc],
    });
  }

  return edges;
}

function routeSubtypeEdges(
  graph: OrmGraph,
  entityPositions: Map<string, PositionedObjectTypeNode>,
): PositionedSubtypeEdge[] {
  const edges: PositionedSubtypeEdge[] = [];

  for (const se of graph.subtypeEdges) {
    const subPos = entityPositions.get(se.subtypeNodeId);
    const superPos = entityPositions.get(se.supertypeNodeId);
    if (!subPos || !superPos) continue;

    const subCenter = entityCenter(subPos);
    const superCenter = entityCenter(superPos);

    const start = entityBorderPoint(subPos, superCenter);
    const end = entityBorderPoint(superPos, subCenter);

    edges.push({
      subtypeNodeId: se.subtypeNodeId,
      supertypeNodeId: se.supertypeNodeId,
      providesIdentification: se.providesIdentification,
      points: [start, end],
    });
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Bounding box computation
// ---------------------------------------------------------------------------

function computeBounds(
  nodes: readonly PositionedNode[],
  edges: readonly PositionedEdge[],
  subtypeEdges: readonly PositionedSubtypeEdge[],
): { width: number; height: number } {
  const PADDING = 40;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  for (const edge of edges) {
    for (const p of edge.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  for (const edge of subtypeEdges) {
    for (const p of edge.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!isFinite(minX)) {
    return { width: 800, height: 600 };
  }

  return {
    width: maxX - minX + 2 * PADDING,
    height: maxY - minY + 2 * PADDING,
  };
}
