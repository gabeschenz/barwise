/**
 * Configuration for a data product entry in the project manifest.
 */
export interface ProductConfig {
  /** File path relative to the project root. */
  readonly path: string;
  /** The bounded context name for this data product. */
  readonly context: string;
  /** Upstream domain contexts this product depends on. */
  readonly dependsOnDomains: readonly string[];
  /** Upstream mapping names this product depends on. */
  readonly dependsOnMappings: readonly string[];
}

/**
 * A data product dependency declaration.
 *
 * Data products are analytical solutions built on top of the common
 * domain data layer. They declare dependencies on source domains and
 * mappings to make upstream lineage explicit.
 */
export class ProductDependency {
  readonly path: string;
  readonly context: string;
  readonly dependsOnDomains: readonly string[];
  readonly dependsOnMappings: readonly string[];

  constructor(config: ProductConfig) {
    if (!config.path || config.path.trim().length === 0) {
      throw new Error("Product path must be a non-empty string.");
    }
    if (!config.context || config.context.trim().length === 0) {
      throw new Error("Product context must be a non-empty string.");
    }
    this.path = config.path.trim();
    this.context = config.context.trim();
    this.dependsOnDomains = [...config.dependsOnDomains];
    this.dependsOnMappings = [...config.dependsOnMappings];
  }
}
