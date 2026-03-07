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
  /** Frequency constraint minimum (undefined = no frequency constraint). */
  readonly frequencyMin?: number;
  /** Frequency constraint maximum (undefined = no frequency constraint). */
  readonly frequencyMax?: number | "unbounded";
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
  /** Alternative names / synonyms for this object type. */
  readonly aliases?: readonly string[];
}

/**
 * A node representing a fact type (the role box bar).
 */
/**
 * Abbreviated ring constraint type labels for diagram rendering.
 */
export type RingTypeLabel =
  | "ir"   // irreflexive
  | "as"   // asymmetric
  | "ans"  // antisymmetric
  | "it"   // intransitive
  | "ac"   // acyclic
  | "sym"  // symmetric
  | "tr"   // transitive
  | "pr";  // purely reflexive

export interface FactTypeNode {
  readonly kind: "fact_type";
  readonly id: string;
  readonly name: string;
  readonly roles: readonly RoleBox[];
  /** Whether a spanning uniqueness constraint covers all roles. */
  readonly hasSpanningUniqueness: boolean;
  /** Ring constraint annotation (if present). */
  readonly ringConstraint?: {
    readonly label: RingTypeLabel;
    readonly roleId1: string;
    readonly roleId2: string;
  };
  /** Whether this fact type is objectified as an entity type. */
  readonly isObjectified?: boolean;
  /** The name of the entity type created by objectification. */
  readonly objectifiedEntityName?: string;
}

/**
 * The visual kind of a constraint node symbol.
 *
 * Each kind maps to a distinct SVG symbol drawn inside a small circle:
 * - external_uniqueness: horizontal bar (single-line uniqueness mark)
 * - exclusion: "X" (roles are mutually exclusive)
 * - exclusive_or: "X" with mandatory dot (exactly one required)
 * - disjunctive_mandatory: filled dot (at least one required)
 * - subset: arrow (one population is a subset of another)
 * - equality: "=" (populations are identical)
 */
export type ConstraintKind =
  | "external_uniqueness"
  | "exclusion"
  | "exclusive_or"
  | "disjunctive_mandatory"
  | "subset"
  | "equality";

/**
 * A node representing an external constraint symbol.
 *
 * In ORM 2 notation, constraints that span roles across multiple fact types
 * are drawn as small symbols (typically a circled bar or dot) with lines
 * connecting to each covered role. This node represents the symbol itself;
 * the connections to roles are ConstraintEdges.
 */
export interface ConstraintNode {
  readonly kind: "constraint";
  readonly id: string;
  /** The type of constraint this node represents. */
  readonly constraintKind: ConstraintKind;
  /** The role ids this constraint covers. */
  readonly roleIds: readonly string[];
  /**
   * For subset constraints: the role ids on the superset side.
   * The main roleIds are the subset side. Constraint edges are created
   * for all roles (both sides); this field distinguishes direction.
   */
  readonly supersetRoleIds?: readonly string[];
}

export type GraphNode = ObjectTypeNode | FactTypeNode | ConstraintNode;

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
 * An edge connecting a constraint node to a role box it covers.
 */
export interface ConstraintEdge {
  readonly constraintNodeId: string;
  /** The fact type node containing the target role. */
  readonly factTypeNodeId: string;
  /** The specific role this edge connects to. */
  readonly roleId: string;
}

/**
 * An edge representing a subtype relationship between two entity types.
 *
 * In ORM 2 notation, subtype relationships are drawn as arrows from the
 * subtype entity to the supertype entity, with an arrowhead at the
 * supertype end.
 */
export interface SubtypeEdge {
  /** The subtype entity type node id (arrow tail). */
  readonly subtypeNodeId: string;
  /** The supertype entity type node id (arrow head). */
  readonly supertypeNodeId: string;
  /** Whether the subtype uses the supertype's reference scheme. */
  readonly providesIdentification: boolean;
}

/**
 * The complete graph representing an ORM model's visual structure.
 */
export interface OrmGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly constraintEdges: readonly ConstraintEdge[];
  readonly subtypeEdges: readonly SubtypeEdge[];
}
