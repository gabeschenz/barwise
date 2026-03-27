/**
 * State transition collector.
 *
 * Identifies switch/case or if/else chains that operate on status/state
 * fields. These encode allowed value sequences and exclusion constraints.
 */

import type { StateTransitionContext } from "../types.js";

/**
 * Patterns that suggest a variable holds state/status.
 */
const STATE_FIELD_PATTERNS = [
  /\bstatus\b/i,
  /\bstate\b/i,
  /\bphase\b/i,
  /\bstage\b/i,
  /\bstep\b/i,
  /\bmode\b/i,
  /\btype\b/i,
  /\bkind\b/i,
  /\bcategory\b/i,
];

/**
 * Extract state transition patterns from TypeScript source code.
 *
 * Looks for switch statements and if/else chains that operate on
 * fields matching state-related naming patterns.
 */
export function collectStateTransitions(
  sourceText: string,
  filePath: string,
): StateTransitionContext[] {
  const transitions: StateTransitionContext[] = [];

  // Find switch statements on state-like fields
  collectSwitchTransitions(sourceText, filePath, transitions);

  return transitions;
}

/**
 * Find switch statements that operate on state-like fields.
 */
function collectSwitchTransitions(
  sourceText: string,
  filePath: string,
  results: StateTransitionContext[],
): void {
  // Match switch (expr) { ... }
  const switchRegex = /\bswitch\s*\(([^)]+)\)\s*\{/g;
  let match;

  while ((match = switchRegex.exec(sourceText)) !== null) {
    const switchExpr = match[1]!.trim();

    // Check if the switch expression references a state-like field
    const stateField = extractStateField(switchExpr);
    if (!stateField) continue;

    const startLine = lineNumber(sourceText, match.index);
    const body = extractBlock(sourceText, match.index + match[0].length - 1);
    const fullSource = match[0] + body + "}";
    const endLine = lineNumber(sourceText, match.index + fullSource.length);

    // Extract case values as transitions
    const caseValues = extractCaseValues(body);

    const transitionPairs = caseValues.length > 1
      ? caseValues.slice(0, -1).map((from, i) => ({
        from,
        to: caseValues[i + 1]!,
      }))
      : undefined;

    results.push({
      stateField,
      filePath,
      startLine,
      endLine,
      sourceText: fullSource,
      transitions: transitionPairs,
    });
  }
}

/**
 * Extract the state field name from a switch expression.
 */
function extractStateField(expr: string): string | undefined {
  // Match patterns like: obj.status, this.state, status, getStatus()
  const fieldMatch = /(?:\w+\.)?(\w+)(?:\(\))?$/.exec(expr.trim());
  if (!fieldMatch) return undefined;

  const field = fieldMatch[1]!;
  if (STATE_FIELD_PATTERNS.some((p) => p.test(field))) {
    return field;
  }
  return undefined;
}

/**
 * Extract case values from a switch body.
 */
function extractCaseValues(body: string): string[] {
  const values: string[] = [];
  const caseRegex = /\bcase\s+['"]([^'"]+)['"]\s*:/g;
  let match;
  while ((match = caseRegex.exec(body)) !== null) {
    values.push(match[1]!);
  }

  // Also try non-string cases (enum members)
  if (values.length === 0) {
    const enumCaseRegex = /\bcase\s+(?:\w+\.)?(\w+)\s*:/g;
    while ((match = enumCaseRegex.exec(body)) !== null) {
      const value = match[1]!;
      if (value !== "default") {
        values.push(value);
      }
    }
  }

  return values;
}

/**
 * Extract the body of a block (between { and matching }).
 */
function extractBlock(source: string, openBrace: number): string {
  let depth = 1;
  let i = openBrace + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    if (depth > 0) i++;
  }
  return source.substring(openBrace + 1, i);
}

/**
 * Get 1-based line number for a character offset.
 */
function lineNumber(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}
