/**
 * SQL cascade parser.
 *
 * Orchestrates per-statement parsing through the cascade:
 * 1. Regex-based pattern extraction (always available)
 * 2. Calcite core parser (requires JVM sidecar)
 * 3. Calcite Babel parser (requires JVM sidecar, multi-dialect)
 * 4. LLM fallback (deferred to enrich() phase)
 *
 * The Calcite sidecar is optional. When unavailable, the parser
 * falls through to regex-based extraction which handles common
 * SQL patterns reliably. The LLM fallback is not invoked here --
 * it is handled by the enrich() method on the format importer.
 */

import { extractSqlPatterns, splitSqlStatements } from "./SqlPatternExtractor.js";
import type {
  CascadeFileResult,
  CascadeStatementResult,
  SqlDialect,
  SqlPatternContext,
} from "./types.js";

/**
 * Parse a SQL file through the cascade.
 *
 * Splits the file into statements and extracts patterns from each.
 * Currently uses regex-based extraction. The Calcite sidecar can be
 * integrated later for higher-fidelity structural parsing.
 *
 * @param sql - The SQL file content
 * @param filePath - Source file path for provenance
 * @param dialect - SQL dialect (affects parsing behavior)
 * @returns Cascade result with per-statement breakdowns
 */
export function parseSqlFile(
  sql: string,
  filePath: string,
  dialect: SqlDialect = "ansi",
): CascadeFileResult {
  const stmts = splitSqlStatements(sql);
  const statementResults: CascadeStatementResult[] = [];
  const allPatterns: SqlPatternContext[] = [];

  let lineOffset = 1;

  for (const stmt of stmts) {
    const result = parseSqlStatement(stmt, filePath, lineOffset, dialect);
    statementResults.push(result);
    allPatterns.push(...result.patterns);

    // Advance line offset past this statement
    lineOffset += stmt.split("\n").length;
  }

  return {
    filePath,
    statements: statementResults,
    patterns: allPatterns,
    dialect,
  };
}

/**
 * Parse a single SQL statement through the cascade.
 *
 * @param sql - The SQL statement text
 * @param filePath - Source file path
 * @param startLine - Start line in the source file
 * @param _dialect - SQL dialect (reserved for Calcite integration)
 * @returns Statement result with extracted patterns
 */
export function parseSqlStatement(
  sql: string,
  filePath: string,
  startLine: number,
  _dialect: SqlDialect = "ansi",
): CascadeStatementResult {
  // Currently uses regex-based extraction only.
  // TODO: When Calcite sidecar is available, try it first and
  // fall back to regex for unsupported syntax.
  const patterns = extractSqlPatterns(sql, filePath, startLine, "regex");

  return {
    sql,
    parseLevel: "regex",
    patterns,
    errors: [],
  };
}

/**
 * Detect the SQL statement type from its first keyword.
 */
export function detectStatementType(
  sql: string,
): "select" | "create" | "alter" | "insert" | "update" | "delete" | "other" {
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith("SELECT") || trimmed.startsWith("WITH")) return "select";
  if (trimmed.startsWith("CREATE")) return "create";
  if (trimmed.startsWith("ALTER")) return "alter";
  if (trimmed.startsWith("INSERT")) return "insert";
  if (trimmed.startsWith("UPDATE")) return "update";
  if (trimmed.startsWith("DELETE")) return "delete";
  return "other";
}
