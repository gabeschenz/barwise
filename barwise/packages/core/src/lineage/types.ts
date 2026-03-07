/**
 * Lineage tracking types for tracing conceptual model elements to
 * generated artifacts (DDL, dbt, Avro, etc.).
 */

/**
 * Reference to a specific model element that contributed to an artifact.
 */
export interface SourceReference {
  readonly elementId: string;
  readonly elementType:
    | "EntityType"
    | "ValueType"
    | "FactType"
    | "Constraint"
    | "SubtypeFact"
    | "Role";
  readonly elementName: string;
}

/**
 * Lineage information for a single generated artifact.
 */
export interface LineageEntry {
  readonly artifact: string;
  readonly sources: readonly SourceReference[];
}

/**
 * Export manifest entry describing a single artifact export with its lineage.
 */
export interface ManifestExport {
  readonly artifact: string;
  readonly format: string;
  readonly exportedAt: string;
  readonly modelHash: string;
  readonly sources: readonly SourceReference[];
}

/**
 * Complete lineage manifest for a model directory.
 * Stored as .barwise/lineage.yaml adjacent to the source model.
 */
export interface LineageManifest {
  readonly version: 1;
  readonly sourceModel: string;
  readonly sourceModelHash: string;
  readonly exports: readonly ManifestExport[];
}
