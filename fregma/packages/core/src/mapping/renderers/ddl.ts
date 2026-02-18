/**
 * DDL renderer.
 *
 * Produces SQL DDL (CREATE TABLE) statements from a RelationalSchema.
 */

import type { RelationalSchema, Table } from "../RelationalSchema.js";

/**
 * Render a RelationalSchema as SQL DDL.
 */
export function renderDdl(schema: RelationalSchema): string {
  return schema.tables.map((t) => renderTable(t)).join("\n\n");
}

function renderTable(table: Table): string {
  const lines: string[] = [];
  lines.push(`CREATE TABLE ${quoteIdent(table.name)} (`);

  const parts: string[] = [];

  // Columns.
  for (const col of table.columns) {
    const nullable = col.nullable ? "" : " NOT NULL";
    parts.push(`  ${quoteIdent(col.name)} ${col.dataType}${nullable}`);
  }

  // Primary key.
  if (table.primaryKey.columnNames.length > 0) {
    const cols = table.primaryKey.columnNames
      .map((c) => quoteIdent(c))
      .join(", ");
    parts.push(`  PRIMARY KEY (${cols})`);
  }

  // Foreign keys.
  for (const fk of table.foreignKeys) {
    const cols = fk.columnNames.map((c) => quoteIdent(c)).join(", ");
    const refCols = fk.referencedColumns
      .map((c) => quoteIdent(c))
      .join(", ");
    parts.push(
      `  FOREIGN KEY (${cols}) REFERENCES ${quoteIdent(fk.referencedTable)} (${refCols})`,
    );
  }

  lines.push(parts.join(",\n"));
  lines.push(");");

  return lines.join("\n");
}

function quoteIdent(name: string): string {
  // Simple quoting: wrap in double quotes if the name contains special chars,
  // otherwise return as-is.
  if (/^[a-z_][a-z0-9_]*$/.test(name)) {
    return name;
  }
  return `"${name.replace(/"/g, '""')}"`;
}
