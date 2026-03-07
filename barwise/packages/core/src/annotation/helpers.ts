/**
 * Shared annotation helpers for barwise YAML annotators.
 *
 * All annotators (dbt import, dbt export, ORM transcript) use the same
 * comment format and stripping logic. These helpers ensure consistency
 * across annotation surfaces.
 *
 * Comment prefixes:
 *   - `# TODO(barwise):` for actionable items needing human review
 *   - `# NOTE(barwise):` for informational context
 */

/**
 * Annotation severity used by all annotators.
 */
export type AnnotationSeverity = "todo" | "note";

/**
 * Format a barwise annotation comment line (without leading indentation).
 *
 * @param severity - "todo" produces `# TODO(barwise):`, "note" produces `# NOTE(barwise):`.
 * @param message - The human-readable annotation message.
 */
export function formatBarwiseComment(
  severity: AnnotationSeverity,
  message: string,
): string {
  const prefix = severity === "note" ? "# NOTE(barwise):" : "# TODO(barwise):";
  return `${prefix} ${message}`;
}

/**
 * Remove all lines that are barwise-injected comments (TODO or NOTE).
 * This makes annotators idempotent -- re-running on already-annotated
 * YAML produces the same result as running on the original.
 */
export function stripBarwiseComments(yaml: string): string {
  return yaml
    .split("\n")
    .filter((line) => !line.match(/^\s*# (?:TODO|NOTE)\(barwise\):/))
    .join("\n");
}

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}
