/**
 * Configuration for an entity mapping.
 */
export interface EntityMappingConfig {
  /** Object type name in the source domain (may be namespace-qualified). */
  readonly sourceObjectType: string;
  /** Object type name in the target domain (may be namespace-qualified). */
  readonly targetObjectType: string;
  /** Optional description of how the mapping works. */
  readonly description?: string;
}

/**
 * A specific correspondence between an object type in one domain
 * and an object type in another, within a context mapping.
 */
export class EntityMapping {
  readonly sourceObjectType: string;
  readonly targetObjectType: string;
  readonly description: string | undefined;

  constructor(config: EntityMappingConfig) {
    if (!config.sourceObjectType || config.sourceObjectType.trim().length === 0) {
      throw new Error("Source object type must be a non-empty string.");
    }
    if (!config.targetObjectType || config.targetObjectType.trim().length === 0) {
      throw new Error("Target object type must be a non-empty string.");
    }
    this.sourceObjectType = config.sourceObjectType.trim();
    this.targetObjectType = config.targetObjectType.trim();
    this.description = config.description;
  }
}
