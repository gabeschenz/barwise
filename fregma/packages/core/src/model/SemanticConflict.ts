/**
 * Configuration for a semantic conflict.
 */
export interface SemanticConflictConfig {
  /** The term that is used differently across domains. */
  readonly term: string;
  /** The meaning in the source domain. */
  readonly sourceMeaning: string;
  /** The meaning in the target domain. */
  readonly targetMeaning: string;
  /** How the warehouse resolves this conflict. */
  readonly resolution: string;
}

/**
 * An explicit documentation of where two domains use the same term
 * with different meanings, and how the warehouse resolves the conflict.
 */
export class SemanticConflict {
  readonly term: string;
  readonly sourceMeaning: string;
  readonly targetMeaning: string;
  readonly resolution: string;

  constructor(config: SemanticConflictConfig) {
    if (!config.term || config.term.trim().length === 0) {
      throw new Error("Semantic conflict term must be a non-empty string.");
    }
    if (!config.resolution || config.resolution.trim().length === 0) {
      throw new Error("Semantic conflict resolution must be a non-empty string.");
    }
    this.term = config.term.trim();
    this.sourceMeaning = config.sourceMeaning;
    this.targetMeaning = config.targetMeaning;
    this.resolution = config.resolution.trim();
  }
}
