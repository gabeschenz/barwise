/**
 * Unified format descriptor types.
 *
 * A FormatDescriptor bundles an optional importer and optional exporter
 * under a single name. This replaces the separate import and export
 * registries with a single registry that exposes both directions.
 *
 * The underlying ImportFormat and ExportFormatAdapter interfaces are
 * unchanged -- the descriptor composes them rather than replacing them.
 */

import type { ImportFormat } from "../import/types.js";
import type { ExportFormatAdapter } from "../export/types.js";

/**
 * A format descriptor that bundles import and/or export capabilities
 * under a single name.
 *
 * At least one of `importer` or `exporter` must be defined. A format
 * that supports both directions (e.g., DDL, OpenAPI) provides both.
 * A format that only supports one direction (e.g., NORMA XML import,
 * Avro export) provides only the relevant field.
 */
export interface FormatDescriptor {
  /** Format identifier (e.g., "ddl", "openapi", "norma", "dbt", "avro"). */
  readonly name: string;

  /** Human-readable description of the format. */
  readonly description: string;

  /** Import capability, if the format supports importing. */
  readonly importer?: ImportFormat;

  /** Export capability, if the format supports exporting. */
  readonly exporter?: ExportFormatAdapter;
}
