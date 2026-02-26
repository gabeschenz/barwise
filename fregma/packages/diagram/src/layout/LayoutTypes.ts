/**
 * Positioned graph types produced by the layout engine.
 *
 * These carry x/y coordinates and dimensions assigned by ELK,
 * ready for direct SVG rendering.
 */

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export interface PositionedRoleBox {
  readonly roleId: string;
  readonly roleName: string;
  readonly playerName: string;
  readonly hasUniqueness: boolean;
  readonly isMandatory: boolean;
  /** Position relative to the parent fact type node. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PositionedObjectTypeNode {
  readonly kind: "object_type";
  readonly id: string;
  readonly name: string;
  readonly objectTypeKind: "entity" | "value";
  readonly referenceMode?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PositionedFactTypeNode {
  readonly kind: "fact_type";
  readonly id: string;
  readonly name: string;
  readonly roles: readonly PositionedRoleBox[];
  readonly hasSpanningUniqueness: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PositionedConstraintNode {
  readonly kind: "constraint";
  readonly id: string;
  readonly constraintKind: "external_uniqueness";
  readonly roleIds: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type PositionedNode =
  | PositionedObjectTypeNode
  | PositionedFactTypeNode
  | PositionedConstraintNode;

export interface PositionedEdge {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly roleId: string;
  readonly points: readonly Position[];
}

/**
 * A positioned subtype edge with routing points for the arrow path.
 */
export interface PositionedSubtypeEdge {
  readonly subtypeNodeId: string;
  readonly supertypeNodeId: string;
  readonly providesIdentification: boolean;
  readonly points: readonly Position[];
}

/**
 * A positioned edge from a constraint node to a role box.
 */
export interface PositionedConstraintEdge {
  readonly constraintNodeId: string;
  readonly factTypeNodeId: string;
  readonly roleId: string;
  readonly points: readonly Position[];
}

export interface PositionedGraph {
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly PositionedEdge[];
  readonly constraintEdges: readonly PositionedConstraintEdge[];
  readonly subtypeEdges: readonly PositionedSubtypeEdge[];
  readonly width: number;
  readonly height: number;
}
