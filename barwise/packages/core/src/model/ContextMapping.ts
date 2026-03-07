import { EntityMapping, type EntityMappingConfig } from "./EntityMapping.js";
import { SemanticConflict, type SemanticConflictConfig } from "./SemanticConflict.js";

/**
 * DDD context mapping patterns.
 */
export type MappingPattern =
  | "shared_kernel"
  | "published_language"
  | "anticorruption_layer";

/**
 * Configuration for a context mapping.
 */
export interface ContextMappingConfig {
  /** File path relative to the project root. */
  readonly path: string;
  /** The source domain context name. */
  readonly sourceContext: string;
  /** The target domain context name. */
  readonly targetContext: string;
  /** The DDD mapping pattern. */
  readonly pattern: MappingPattern;
  /** Entity-level mappings. */
  readonly entityMappings?: readonly EntityMappingConfig[];
  /** Documented semantic conflicts. */
  readonly semanticConflicts?: readonly SemanticConflictConfig[];
}

/**
 * A relationship between two domain models, loaded from a `.map.yaml` file.
 *
 * Documents how concepts translate across context boundaries, including
 * entity-level correspondences and semantic conflicts.
 */
export class ContextMapping {
  readonly path: string;
  readonly sourceContext: string;
  readonly targetContext: string;
  readonly pattern: MappingPattern;
  private readonly _entityMappings: EntityMapping[];
  private readonly _semanticConflicts: SemanticConflict[];

  constructor(config: ContextMappingConfig) {
    if (!config.path || config.path.trim().length === 0) {
      throw new Error("Context mapping path must be a non-empty string.");
    }
    if (!config.sourceContext || config.sourceContext.trim().length === 0) {
      throw new Error("Source context must be a non-empty string.");
    }
    if (!config.targetContext || config.targetContext.trim().length === 0) {
      throw new Error("Target context must be a non-empty string.");
    }
    if (config.sourceContext.trim() === config.targetContext.trim()) {
      throw new Error(
        "Source and target contexts must be different "
          + `(both are "${config.sourceContext.trim()}").`,
      );
    }

    this.path = config.path.trim();
    this.sourceContext = config.sourceContext.trim();
    this.targetContext = config.targetContext.trim();
    this.pattern = config.pattern;

    this._entityMappings = (config.entityMappings ?? []).map(
      (em) => new EntityMapping(em),
    );
    this._semanticConflicts = (config.semanticConflicts ?? []).map(
      (sc) => new SemanticConflict(sc),
    );
  }

  get entityMappings(): readonly EntityMapping[] {
    return this._entityMappings;
  }

  get semanticConflicts(): readonly SemanticConflict[] {
    return this._semanticConflicts;
  }

  /** Add an entity mapping. */
  addEntityMapping(config: EntityMappingConfig): EntityMapping {
    const em = new EntityMapping(config);
    this._entityMappings.push(em);
    return em;
  }

  /** Add a semantic conflict. */
  addSemanticConflict(config: SemanticConflictConfig): SemanticConflict {
    const sc = new SemanticConflict(config);
    this._semanticConflicts.push(sc);
    return sc;
  }

  /** Check if this mapping involves a given context. */
  involvesContext(context: string): boolean {
    return this.sourceContext === context || this.targetContext === context;
  }
}
