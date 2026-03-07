/**
 * Severity level for a validation diagnostic.
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * A diagnostic produced by the validation engine.
 *
 * Each diagnostic identifies a specific problem (or informational note)
 * about the model, including which element is affected and which rule
 * produced it.
 */
export interface Diagnostic {
  /** The severity of the diagnostic. */
  readonly severity: DiagnosticSeverity;
  /** Human-readable description of the problem. */
  readonly message: string;
  /** The id of the model element this diagnostic applies to. */
  readonly elementId: string;
  /** The rule identifier that produced this diagnostic. */
  readonly ruleId: string;
}
