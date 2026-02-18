/**
 * Platform-independent graph types for ORM diagram layout.
 *
 * These types represent the intermediate graph structure between an
 * OrmModel and the final positioned SVG output. The graph is consumed
 * by the layout engine (ELK) and the SVG renderer.
 */

/**
 * A role box within a fact type node.
 *
 * Each role in an ORM fact type is rendered as a rectangular box
 * within the fact type bar. The role box carries constraint markers
 * (uniqueness bar, mandatory dot) that are rendered on top of or
 * adjacent to the box.
 */
export interface RoleBox {
  readonly roleId: string;
  readonly roleName: string;
  readonly playerId: string;
  readonly playerName: string;
  /** Whether this role has an internal uniqueness constraint (single-role). */
  readonly hasUniqueness: boolean;
  /** Whether this role is mandatory. */
  readonly isMandatory: boolean;
}

/**
 * A node representing an object type (entity or value).
 */
export interface ObjectTypeNode {
  readonly kind: "object_type";
  readonly id: string;
  readonly name: string;
  readonly objectTypeKind: "entity" | "value";
  /** Reference mode for entity types (e.g. "customer_id"). */
  readonly referenceMode?: string;
}

/**
 * A node representing a fact type (the role box bar).
 */
export interface FactTypeNode {
  readonly kind: "fact_type";
  readonly id: string;
  readonly name: string;
  readonly roles: readonly RoleBox[];
  /** Whether a spanning uniqueness constraint covers all roles. */
  readonly hasSpanningUniqueness: boolean;
}

export type GraphNode = ObjectTypeNode | FactTypeNode;

/**
 * An edge connecting an object type to a role box within a fact type.
 */
export interface GraphEdge {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  /** The role id this edge connects to (port on the fact type node). */
  readonly roleId: string;
}

/**
 * The complete graph representing an ORM model's visual structure.
 */
export interface OrmGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}
