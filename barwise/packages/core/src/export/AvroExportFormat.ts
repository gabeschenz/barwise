/**
 * Avro export format adapter.
 *
 * Wraps the existing renderAvro() function as an ExportFormatAdapter, adding:
 * - Validation with strict mode support
 * - Multi-file ExportResult with individual .avsc files
 */

import { RelationalMapper } from "../mapping/RelationalMapper.js";
import { avroSchemaToJson, renderAvro } from "../mapping/renderers/avro.js";
import type { OrmModel } from "../model/OrmModel.js";
import { ValidationEngine } from "../validation/ValidationEngine.js";
import type { ExportFormatAdapter, ExportOptions, ExportResult } from "./types.js";

/**
 * Apache Avro schema export format.
 *
 * Produces Avro record schemas (.avsc JSON) from an ORM model via
 * relational mapping. Each table becomes an Avro record type.
 */
export class AvroExportFormat implements ExportFormatAdapter {
  readonly name = "avro";
  readonly description = "Apache Avro schema definitions (.avsc)";

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

    // Extract Avro-specific options.
    const namespace = options?.namespace as string | undefined;

    // Render Avro schemas.
    const avroSchemaSet = renderAvro(schema, { namespace });

    // Build individual files.
    const files: Array<{ name: string; content: string; }> = [];
    const schemaTexts: string[] = [];

    for (const avroSchema of avroSchemaSet.schemas) {
      const json = avroSchemaToJson(avroSchema);
      const fileName = `${avroSchema.name}.avsc`;
      files.push({ name: fileName, content: json });
      schemaTexts.push(`# ${fileName}\n${json}`);
    }

    // Build combined text view.
    const sections: string[] = [];

    // Include validation warnings if present.
    if (errors.length > 0) {
      sections.push(
        `# Validation warnings:\n${errors.map((e) => `# ERROR: ${e.message}`).join("\n")}`,
      );
    }

    sections.push(...schemaTexts);

    const text = sections.join("\n\n---\n\n");

    return {
      text,
      files,
    };
  }
}

/**
 * Singleton instance of the Avro export format.
 */
export const avroExportFormat = new AvroExportFormat();
