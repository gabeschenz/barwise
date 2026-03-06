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
