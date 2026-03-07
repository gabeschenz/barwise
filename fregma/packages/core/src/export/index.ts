/**
 * Export system barrel file.
 *
 * Re-exports all export format types, registry functions, and format adapters.
 */

// Core types.
export type {
  ExportFormatAdapter,
  ExportOptions,
  ExportResult,
  ConstraintSpec,
  SourceReference,
  LineageEntry,
} from "./types.js";

// Registry.
export {
  formatRegistry,
  registerFormat,
  getFormat,
  listFormats,
} from "./registry.js";

// Format adapters.
export { DdlExportFormat, ddlExportFormat } from "./DdlExportFormat.js";
export {
  OpenApiExportFormat,
  openApiExportFormat,
} from "./OpenApiExportFormat.js";
