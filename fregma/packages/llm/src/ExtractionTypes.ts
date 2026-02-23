/**
 * Types for the LLM extraction pipeline.
 *
 * These represent the structured output the LLM produces when
 * processing a transcript, and the intermediate forms used to
 * convert that output into an OrmModel.
 */

// ---------------------------------------------------------------------------
// Source references (traceability from model elements back to transcript)
// ---------------------------------------------------------------------------

/**
 * A reference to a specific location in the source transcript.
 * Provides an audit trail from extracted model elements back to
 * the stakeholder's actual words.
 */
export interface SourceReference {
  /** Start and end line numbers in the transcript (1-based, inclusive). */
  readonly lines: readonly [number, number];
  /** Verbatim excerpt from the transcript. */
  readonly excerpt: string;
}

// ---------------------------------------------------------------------------
// Extraction response (what the LLM produces)
// ---------------------------------------------------------------------------

export interface ExtractedObjectType {
  readonly name: string;
  readonly kind: "entity" | "value";
  readonly definition?: string;
  /** Reference mode for entity types (e.g. "customer_id"). */
  readonly reference_mode?: string;
  /** Enumerated values for value types. */
  readonly value_constraint?: { readonly values: readonly string[] };
  readonly source_references: readonly SourceReference[];
}

export interface ExtractedRole {
  /** Object type name (not id -- names are resolved during parsing). */
  readonly player: string;
  readonly role_name: string;
}

export interface ExtractedFactType {
  readonly name: string;
  readonly roles: readonly ExtractedRole[];
  /** Reading templates, e.g. ["{0} places {1}", "{1} is placed by {0}"]. */
  readonly readings: readonly string[];
  readonly source_references: readonly SourceReference[];
}

export type InferredConstraintType =
  | "internal_uniqueness"
  | "mandatory"
  | "value_constraint";

export interface InferredConstraint {
  readonly type: InferredConstraintType;
  /** The name of the fact type this constraint applies to. */
  readonly fact_type: string;
  /**
   * Role player names identifying which roles the constraint covers.
   * For internal_uniqueness: the player names of the unique roles.
   * For mandatory: the player name of the mandatory role.
   */
  readonly roles: readonly string[];
  /** Human-readable description of the business rule. */
  readonly description: string;
  readonly confidence: "high" | "medium" | "low";
  readonly source_references: readonly SourceReference[];
}

export interface ExtractedSubtype {
  /** Name of the subtype entity (must match an extracted object type). */
  readonly subtype: string;
  /** Name of the supertype entity (must match an extracted object type). */
  readonly supertype: string;
  /** Whether the subtype uses the supertype's identification scheme. */
  readonly provides_identification?: boolean;
  /** Human-readable description of the subtype relationship. */
  readonly description: string;
  readonly source_references: readonly SourceReference[];
}

export interface Ambiguity {
  readonly description: string;
  readonly source_references: readonly SourceReference[];
}

/**
 * The complete structured response from the LLM extraction.
 * This is the JSON shape the LLM is instructed to produce.
 */
export interface ExtractionResponse {
  readonly object_types: readonly ExtractedObjectType[];
  readonly fact_types: readonly ExtractedFactType[];
  readonly subtypes: readonly ExtractedSubtype[];
  readonly inferred_constraints: readonly InferredConstraint[];
  readonly ambiguities: readonly Ambiguity[];
}

// ---------------------------------------------------------------------------
// Draft model result (what the parser produces)
// ---------------------------------------------------------------------------

/**
 * Metadata attached to a model element tracing it back to the transcript.
 */
export interface ElementProvenance {
  readonly elementName: string;
  readonly sourceReferences: readonly SourceReference[];
}

/**
 * A constraint that the LLM inferred with its confidence level.
 */
export interface ConstraintProvenance {
  readonly description: string;
  readonly confidence: "high" | "medium" | "low";
  readonly sourceReferences: readonly SourceReference[];
  readonly applied: boolean;
  /** If not applied, the reason it was skipped. */
  readonly skipReason?: string;
}

/**
 * Provenance for a subtype relationship extracted by the LLM.
 */
export interface SubtypeProvenance {
  readonly subtype: string;
  readonly supertype: string;
  readonly sourceReferences: readonly SourceReference[];
  readonly applied: boolean;
  /** If not applied, the reason it was skipped. */
  readonly skipReason?: string;
}

/**
 * The result of parsing an extraction response into an OrmModel.
 */
export interface DraftModelResult {
  /** The constructed ORM model (may be incomplete). */
  readonly model: import("@fregma/core").OrmModel;
  /** Provenance for each extracted object type. */
  readonly objectTypeProvenance: readonly ElementProvenance[];
  /** Provenance for each extracted fact type. */
  readonly factTypeProvenance: readonly ElementProvenance[];
  /** Status of each extracted subtype relationship. */
  readonly subtypeProvenance: readonly SubtypeProvenance[];
  /** Status of each inferred constraint. */
  readonly constraintProvenance: readonly ConstraintProvenance[];
  /** Ambiguities identified by the LLM. */
  readonly ambiguities: readonly Ambiguity[];
  /** Warnings generated during parsing (non-fatal issues). */
  readonly warnings: readonly string[];
}
