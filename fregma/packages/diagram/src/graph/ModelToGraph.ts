import type { OrmModel } from "@fregma/core";
import type {
  OrmGraph,
  ObjectTypeNode,
  FactTypeNode,
  GraphEdge,
  RoleBox,
} from "./GraphTypes.js";

/**
 * Convert an OrmModel into an OrmGraph suitable for layout and rendering.
 *
 * This is the bridge between the semantic model and the visual representation.
 * Each object type becomes an ObjectTypeNode, each fact type becomes a
 * FactTypeNode with RoleBox children, and each role-player relationship
 * becomes a GraphEdge.
 */
export function modelToGraph(model: OrmModel): OrmGraph {
  const nodes: (ObjectTypeNode | FactTypeNode)[] = [];
  const edges: GraphEdge[] = [];

  // Create object type nodes.
  for (const ot of model.objectTypes) {
    nodes.push({
      kind: "object_type",
      id: ot.id,
      name: ot.name,
      objectTypeKind: ot.kind,
      referenceMode: ot.referenceMode,
    });
  }

  // Create fact type nodes and edges.
  for (const ft of model.factTypes) {
    // Determine which roles have single-role internal uniqueness.
    const singleRoleUniqueIds = new Set<string>();
    let hasSpanning = false;

    for (const c of ft.constraints) {
      if (c.type === "internal_uniqueness") {
        if (c.roleIds.length === 1 && c.roleIds[0]) {
          singleRoleUniqueIds.add(c.roleIds[0]);
        } else if (c.roleIds.length === ft.arity) {
          hasSpanning = true;
        }
      }
    }

    // Determine which roles are mandatory.
    const mandatoryRoleIds = new Set<string>();
    for (const c of ft.constraints) {
      if (c.type === "mandatory") {
        mandatoryRoleIds.add(c.roleId);
      }
    }

    // Build role boxes.
    const roleBoxes: RoleBox[] = ft.roles.map((role) => {
      const player = model.getObjectType(role.playerId);
      return {
        roleId: role.id,
        roleName: role.name,
        playerId: role.playerId,
        playerName: player?.name ?? "?",
        hasUniqueness: singleRoleUniqueIds.has(role.id),
        isMandatory: mandatoryRoleIds.has(role.id),
      };
    });

    nodes.push({
      kind: "fact_type",
      id: ft.id,
      name: ft.name,
      roles: roleBoxes,
      hasSpanningUniqueness: hasSpanning,
    });

    // Create edges from each role's player object type to the fact type.
    for (const role of ft.roles) {
      edges.push({
        sourceNodeId: role.playerId,
        targetNodeId: ft.id,
        roleId: role.id,
      });
    }
  }

  return { nodes, edges };
}
