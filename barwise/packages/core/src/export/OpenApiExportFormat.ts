/**
 * OpenAPI export format adapter.
 *
 * Wraps the existing renderOpenApi() function as an ExportFormat, adding:
 * - Validation with strict mode support
 * - ExportResult structure
 * - Option forwarding (title, version, basePath)
 */

import type { OrmModel } from "../model/OrmModel.js";
import type {
  ExportFormatAdapter,
  ExportOptions,
  ExportResult,
} from "./types.js";
import { RelationalMapper } from "../mapping/RelationalMapper.js";
import { renderOpenApi, openApiToJson } from "../mapping/renderers/openapi.js";
import { ValidationEngine } from "../validation/ValidationEngine.js";

/**
 * OpenAPI 3.0 export format.
 *
 * Produces an OpenAPI 3.0.0 specification from an ORM model via relational mapping.
 */
export class OpenApiExportFormat implements ExportFormatAdapter {
  readonly name = "openapi";
  readonly description = "OpenAPI 3.0 specification (JSON)";

  export(model: OrmModel, options?: ExportOptions): ExportResult {
    const strict = options?.strict ?? false;

    // Run validation.
    const engine = new ValidationEngine();
    const diagnostics = engine.validate(model);
    const errors = diagnostics.filter((d) => d.severity === "error");

    // If strict mode and there are errors, throw.
    if (strict && errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join("\n");
      throw new Error(
        `Cannot export model with validation errors in strict mode:\n${errorMessages}`,
      );
    }

    // Map to relational schema.
    const mapper = new RelationalMapper();
    const schema = mapper.map(model);

    // Extract OpenAPI-specific options.
    const title = (options?.title as string | undefined) ?? model.name;
    const version = (options?.version as string | undefined) ?? "1.0.0";
    const basePath = options?.basePath as string | undefined;

    // Render OpenAPI spec.
    const spec = renderOpenApi(schema, {
      title,
      version,
      basePath,
    });

    // Serialize to JSON.
    const text = openApiToJson(spec);

    // Include validation diagnostics as a comment if present and not strict.
    // OpenAPI doesn't have a native comment mechanism, so we'll prepend as a
    // YAML-style comment block (even though the output is JSON).
    // Alternatively, we could include it in the description field, but that's
    // not ideal. For now, just include errors as a warning string in the result
    // if they exist.
    const validationWarnings =
      errors.length > 0
        ? `/* Validation warnings:\n${errors.map((e) => ` * ERROR: ${e.message}`).join("\n")}\n */\n\n`
        : "";

    return {
      text: validationWarnings + text,
      // OpenAPI is a single-file format (JSON or YAML), so no files array.
      // annotations and constraintSpecs will be added in Stage B/C.
    };
  }
}

/**
 * Singleton instance of the OpenAPI export format.
 */
export const openApiExportFormat = new OpenApiExportFormat();
