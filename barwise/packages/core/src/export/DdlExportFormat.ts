/**
 * DDL export format adapter.
 *
 * Wraps the existing renderDdl() function as an ExportFormat, adding:
 * - Validation with strict mode support
 * - Annotation support (constraint comments in SQL)
 * - ExportResult structure
 */

import { RelationalMapper } from "../mapping/RelationalMapper.js";
import { renderDdl } from "../mapping/renderers/ddl.js";
import type { OrmModel } from "../model/OrmModel.js";
import { ValidationEngine } from "../validation/ValidationEngine.js";
import type { ExportFormatAdapter, ExportOptions, ExportResult } from "./types.js";

/**
 * DDL (SQL CREATE TABLE) export format.
 *
 * Produces SQL DDL from an ORM model via relational mapping.
 */
export class DdlExportFormat implements ExportFormatAdapter {
  readonly name = "ddl";
  readonly description = "SQL DDL (CREATE TABLE statements)";

  export(model: OrmModel, options?: ExportOptions): ExportResult {
    const annotate = options?.annotate ?? true;
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

    // Render DDL.
    let ddlText = renderDdl(schema);

    // If annotate is true, add constraint annotations as SQL comments.
    if (annotate) {
      ddlText = this.addConstraintAnnotations(ddlText, model, schema);
    }

    // Include validation diagnostics as warnings in the result if present.
    const validationWarnings = errors.length > 0
      ? `-- Validation warnings:\n${errors.map((e) => `-- ERROR: ${e.message}`).join("\n")}\n\n`
      : "";

    const text = validationWarnings + ddlText;

    return {
      text,
      // DDL is a single-file format, so no files array.
      // annotations and constraintSpecs will be added in Stage B/C.
    };
  }

  /**
   * Add constraint annotations as SQL comments.
   *
   * This is a placeholder implementation for Stage A. Stage B will expand
   * this to include detailed constraint specifications (verbalization,
   * pseudocode, examples) for constraints that DDL cannot express natively.
   *
   * For now, we add simple comments for each table indicating which ORM
   * element it came from.
   */
  private addConstraintAnnotations(
    ddl: string,
    model: OrmModel,
    schema: ReturnType<InstanceType<typeof RelationalMapper>["map"]>,
  ): string {
    const lines = ddl.split("\n");
    const result: string[] = [];

    for (const table of schema.tables) {
      // Find the CREATE TABLE line for this table.
      const createTablePattern = new RegExp(
        `^CREATE TABLE ("|)${table.name}("|) \\(`,
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        if (createTablePattern.test(line)) {
          // Find the source element (entity or fact type) that produced this table.
          const sourceElement = model.objectTypes.find((ot) => ot.id === table.sourceElementId)
            ?? model.factTypes.find((ft) => ft.id === table.sourceElementId);

          if (sourceElement) {
            result.push(`-- Table: ${table.name}`);
            result.push(`-- Source: ${sourceElement.name} (${sourceElement.id})`);

            // If the source has a definition, include it.
            if ("definition" in sourceElement && sourceElement.definition) {
              result.push(`-- Definition: ${sourceElement.definition}`);
            }
          }
        }

        result.push(line);
      }
    }

    return result.join("\n");
  }
}

/**
 * Singleton instance of the DDL export format.
 */
export const ddlExportFormat = new DdlExportFormat();
