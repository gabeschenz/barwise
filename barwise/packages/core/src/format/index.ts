/**
 * Unified format system.
 *
 * Re-exports everything consumers need from the format module.
 */

export type { FormatDescriptor } from "./types.js";
export {
  formatRegistry,
  FormatRegistryError,
  registerFormat,
  getFormat,
  getImporter,
  getExporter,
  listFormats,
  listImporters,
  listExporters,
  clearFormats,
} from "./registry.js";
export {
  ddlFormat,
  openApiFormat,
  registerBuiltinFormats,
} from "./formats.js";
