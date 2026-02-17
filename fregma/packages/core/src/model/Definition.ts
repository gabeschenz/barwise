/**
 * A Definition is a ubiquitous language entry that may or may not be
 * directly attached to a model element.
 *
 * Standalone definitions capture domain terms that are important for
 * shared understanding but don't correspond to a specific object type
 * or fact type in the model (yet).
 */
export interface Definition {
  /** The term being defined. */
  readonly term: string;
  /** The natural-language definition. */
  readonly definition: string;
  /** The bounded context in which this term applies. */
  readonly context?: string;
}
