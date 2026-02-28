/**
 * Shared annotation helpers for fregma YAML annotators.
 *
 * All annotators (dbt import, dbt export, ORM transcript) use the same
 * comment format and stripping logic. These helpers ensure consistency
 * across annotation surfaces.
 *
 * Comment prefixes:
 *   - `# TODO(fregma):` for actionable items needing human review
 *   - `# NOTE(fregma):` for informational context
 */

/**
 * Annotation severity used by all annotators.
 */
export type AnnotationSeverity = "todo" | "note";

/**
 * Format a fregma annotation comment line (without leading indentation).
 *
 * @param severity - "todo" produces `# TODO(fregma):`, "note" produces `# NOTE(fregma):`.
 * @param message - The human-readable annotation message.
 */
export function formatFregmaComment(
  severity: AnnotationSeverity,
  message: string,
): string {
  const prefix =
    severity === "note" ? "# NOTE(fregma):" : "# TODO(fregma):";
  return `${prefix} ${message}`;
}

/**
 * Remove all lines that are fregma-injected comments (TODO or NOTE).
 * This makes annotators idempotent -- re-running on already-annotated
 * YAML produces the same result as running on the original.
 */
export function stripFregmaComments(yaml: string): string {
  return yaml
    .split("\n")
    .filter((line) => !line.match(/^\s*# (?:TODO|NOTE)\(fregma\):/))
    .join("\n");
}

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}
