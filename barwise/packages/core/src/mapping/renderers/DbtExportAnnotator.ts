/**
 * dbt export annotator.
 *
 * Analyzes an ORM model and its relational mapping to inject TODO/NOTE
 * comments into the rendered dbt schema.yml, highlighting gaps that
 * an engineer should review:
 *
 *   - `# TODO(barwise):` for actionable gaps (missing descriptions,
 *     default data types needing review)
 *   - `# NOTE(barwise):` for informational notes (composite PKs,
 *     value constraints available for accepted_values tests)
 *
 * Like the import annotator, this operates at the text level to
 * preserve YAML formatting and is idempotent.
 */

import {
  collectExportAnnotations,
  type ExportAnnotation,
} from "../../annotation/ExportAnnotationCollector.js";
import { formatBarwiseComment, stripBarwiseComments } from "../../annotation/helpers.js";
import type { OrmModel } from "../../model/OrmModel.js";
import type { RelationalSchema } from "../RelationalSchema.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Re-export for backward compatibility -- consumers that imported
// ExportAnnotation from this module continue to work.
export type { ExportAnnotation } from "../../annotation/ExportAnnotationCollector.js";

export interface ExportAnnotationResult {
  /** The annotated schema.yml string. */
  readonly schemaYaml: string;
  /** All annotations that were generated (for reporting). */
  readonly annotations: readonly ExportAnnotation[];
}

/**
 * Annotate a rendered dbt schema.yml with TODO/NOTE comments based on
 * analysis of the source ORM model and relational schema.
 *
 * @param schemaYaml - The schema.yml string produced by renderDbt().
 * @param model - The ORM model that was mapped.
 * @param schema - The relational schema produced by RelationalMapper.
 */
export function annotateDbtExport(
  schemaYaml: string,
  model: OrmModel,
  schema: RelationalSchema,
): ExportAnnotationResult {
  const annotations = collectExportAnnotations(model, schema);

  if (annotations.length === 0) {
    return { schemaYaml: stripBarwiseComments(schemaYaml), annotations };
  }

  const cleanYaml = stripBarwiseComments(schemaYaml);

  // Index annotations by table and table::column.
  const modelAnnotations = new Map<string, ExportAnnotation[]>();
  const columnAnnotations = new Map<string, ExportAnnotation[]>();

  for (const a of annotations) {
    if (a.columnName) {
      const key = `${a.tableName}::${a.columnName}`;
      const existing = columnAnnotations.get(key) ?? [];
      existing.push(a);
      columnAnnotations.set(key, existing);
    } else {
      const existing = modelAnnotations.get(a.tableName) ?? [];
      existing.push(a);
      modelAnnotations.set(a.tableName, existing);
    }
  }

  // Inject comments into the YAML text.
  const lines = cleanYaml.split("\n");
  const result: string[] = [];
  let currentModelName: string | undefined;

  for (const line of lines) {
    result.push(line);

    // Detect model-level `- name:` (indented 2-4 spaces).
    const modelMatch = line.match(/^(\s{2,4})- name:\s*(\S+)/);
    if (modelMatch) {
      currentModelName = modelMatch[2];
      const indent = modelMatch[1]! + "  ";

      const mAnnotations = modelAnnotations.get(currentModelName!);
      if (mAnnotations) {
        for (const a of mAnnotations) {
          result.push(`${indent}${formatAnnotationComment(a)}`);
        }
      }
      continue;
    }

    // Detect column-level `- name:` (indented 6-8 spaces).
    const colMatch = line.match(/^(\s{6,8})- name:\s*(\S+)/);
    if (colMatch && currentModelName) {
      const columnName = colMatch[2]!;
      const indent = colMatch[1]! + "  ";
      const key = `${currentModelName}::${columnName}`;

      const cAnnotations = columnAnnotations.get(key);
      if (cAnnotations) {
        for (const a of cAnnotations) {
          result.push(`${indent}${formatAnnotationComment(a)}`);
        }
      }
    }
  }

  return { schemaYaml: result.join("\n"), annotations };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAnnotationComment(annotation: ExportAnnotation): string {
  return formatBarwiseComment(annotation.severity, annotation.message);
}
