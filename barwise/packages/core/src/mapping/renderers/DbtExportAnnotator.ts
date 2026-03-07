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

import { formatBarwiseComment, stripBarwiseComments, truncate } from "../../annotation/helpers.js";
import type { OrmModel } from "../../model/OrmModel.js";
import type { RelationalSchema } from "../RelationalSchema.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExportAnnotation {
  /** Which table this annotation is for. */
  readonly tableName: string;
  /** Which column, if column-level (undefined = model-level). */
  readonly columnName?: string;
  /** Severity: "todo" produces `# TODO(barwise):`, "note" produces `# NOTE(barwise):`. */
  readonly severity: "todo" | "note";
  /** Annotation category. */
  readonly category: string;
  /** Human-readable message. */
  readonly message: string;
}

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
  const annotations = collectAnnotations(model, schema);

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
// Annotation collection
// ---------------------------------------------------------------------------

function collectAnnotations(
  model: OrmModel,
  schema: RelationalSchema,
): ExportAnnotation[] {
  const annotations: ExportAnnotation[] = [];

  // Build lookup maps from ORM model.
  const entityById = new Map(
    model.objectTypes.filter((ot) => ot.kind === "entity").map((e) => [e.id, e]),
  );
  const valueById = new Map(
    model.objectTypes.filter((ot) => ot.kind === "value").map((v) => [v.id, v]),
  );

  for (const table of schema.tables) {
    const entity = entityById.get(table.sourceElementId);

    // --- Model-level annotations ---

    // Missing model description.
    if (entity) {
      if (entity.definition) {
        annotations.push({
          tableName: table.name,
          severity: "note",
          category: "description",
          message: `Definition available from ORM model: "${truncate(entity.definition, 80)}"`,
        });
      } else {
        annotations.push({
          tableName: table.name,
          severity: "todo",
          category: "description",
          message:
            "No model description. Add a definition to the ORM entity type or edit the dbt YAML.",
        });
      }
    }

    // Composite PK note.
    if (table.primaryKey.columnNames.length > 1) {
      annotations.push({
        tableName: table.name,
        severity: "note",
        category: "constraint",
        message: `Composite primary key (${
          table.primaryKey.columnNames.join(", ")
        }). Individual unique tests are not generated.`,
      });
    }

    // --- Column-level annotations ---

    for (const col of table.columns) {
      // Find the value type that sourced this column (via role traceability).
      const sourceValueType = col.sourceRoleId
        ? findValueTypeForRole(col.sourceRoleId, model, valueById)
        : undefined;

      // Missing column description.
      annotations.push({
        tableName: table.name,
        columnName: col.name,
        severity: "todo",
        category: "description",
        message: "No column description. Add one to the dbt YAML.",
      });

      // Default TEXT data type.
      if (col.dataType === "TEXT") {
        annotations.push({
          tableName: table.name,
          columnName: col.name,
          severity: "todo",
          category: "data_type",
          message:
            "Data type defaulted to TEXT. Add a data type to the ORM value type or edit the dbt YAML.",
        });
      }

      // Value constraint available for accepted_values test.
      if (sourceValueType?.valueConstraint) {
        const vals = sourceValueType.valueConstraint.values;
        annotations.push({
          tableName: table.name,
          columnName: col.name,
          severity: "note",
          category: "accepted_values",
          message: `Value constraint available: [${
            vals.map((v) => `'${v}'`).join(", ")
          }]. Consider adding an accepted_values test.`,
        });
      }
    }
  }

  return annotations;
}

/**
 * Given a role ID from a relational column's sourceRoleId, find the
 * value type in the same fact type. The sourceRoleId points to the
 * entity's role; the value type plays the *other* role.
 */
function findValueTypeForRole(
  roleId: string,
  model: OrmModel,
  valueById: Map<string, InstanceType<typeof import("../../model/ObjectType.js").ObjectType>>,
): InstanceType<typeof import("../../model/ObjectType.js").ObjectType> | undefined {
  for (const ft of model.factTypes) {
    const matchIdx = ft.roles.findIndex((r) => r.id === roleId);
    if (matchIdx === -1) continue;

    // The matched role is the entity's role. Look for a value type
    // among the other roles in this fact type.
    for (let i = 0; i < ft.roles.length; i++) {
      if (i === matchIdx) continue;
      const vt = valueById.get(ft.roles[i]!.playerId);
      if (vt) return vt;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAnnotationComment(annotation: ExportAnnotation): string {
  return formatBarwiseComment(annotation.severity, annotation.message);
}
