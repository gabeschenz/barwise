/**
 * Lineage tracking for tracing conceptual model elements to generated artifacts.
 */

export type {
  SourceReference,
  LineageEntry,
  ManifestExport,
  LineageManifest,
} from "./types.js";

export {
  writeManifest,
  readManifest,
  updateManifest,
  hashModel,
} from "./manifest.js";

export {
  generateDdlLineage,
  generateModelLineage,
} from "./generate.js";

export type {
  StaleArtifact,
  StalenessReport,
} from "./staleness.js";

export {
  checkStaleness,
} from "./staleness.js";

export type {
  AffectedArtifact,
  ImpactReport,
} from "./impact.js";

export {
  analyzeImpact,
} from "./impact.js";
