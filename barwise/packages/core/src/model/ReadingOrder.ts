/**
 * A ReadingOrder is a natural-language template for verbalizing a fact type.
 *
 * The template uses positional placeholders like "{0}" and "{1}" that
 * correspond to the roles in the fact type by index. For example, a binary
 * fact type with roles [Customer, Order] might have readings:
 *   - "{0} places {1}"          (forward: "Customer places Order")
 *   - "{1} is placed by {0}"    (inverse: "Order is placed by Customer")
 *
 * Every fact type must have at least one reading. Binary fact types
 * typically have two (forward and inverse).
 */
export interface ReadingOrder {
  /** Template string with positional placeholders: "{0}", "{1}", etc. */
  readonly template: string;
}

/**
 * Validates that a reading template's placeholders are consistent with
 * the expected number of roles.
 *
 * @param template - The reading template string.
 * @param roleCount - The number of roles in the fact type.
 * @returns An array of error messages (empty if valid).
 */
export function validateReadingTemplate(
  template: string,
  roleCount: number,
): string[] {
  const errors: string[] = [];

  if (!template || template.trim().length === 0) {
    errors.push("Reading template must be a non-empty string.");
    return errors;
  }

  // Extract all placeholder indices from the template.
  const placeholderPattern = /\{(\d+)\}/g;
  const foundIndices = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(template)) !== null) {
    const index = parseInt(match[1]!, 10);
    foundIndices.add(index);
  }

  // Every role index [0..roleCount-1] should appear at least once.
  for (let i = 0; i < roleCount; i++) {
    if (!foundIndices.has(i)) {
      errors.push(
        `Reading template "${template}" is missing placeholder {${i}} ` +
          `(expected ${roleCount} role references).`,
      );
    }
  }

  // No placeholder should reference an index >= roleCount.
  for (const index of foundIndices) {
    if (index >= roleCount) {
      errors.push(
        `Reading template "${template}" references {${index}} but the ` +
          `fact type only has ${roleCount} roles.`,
      );
    }
  }

  return errors;
}

/**
 * Expands a reading template by substituting role placeholders with
 * the provided names.
 *
 * @param template - The reading template (e.g. "{0} places {1}").
 * @param roleNames - Array of names to substitute, indexed by position.
 * @returns The expanded reading (e.g. "Customer places Order").
 */
export function expandReading(
  template: string,
  roleNames: readonly string[],
): string {
  return template.replace(/\{(\d+)\}/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return roleNames[index] ?? `{${index}}`;
  });
}
