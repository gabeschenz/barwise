/**
 * Guiding model loader.
 *
 * Loads an existing ORM model from a `.orm.yaml` file and extracts
 * entity type names. These names are used to focus code analysis on
 * files that reference known entities, improving relevance and
 * reducing noise in large codebases.
 */

import { OrmYamlSerializer } from "@barwise/core";
import { readFileSync } from "node:fs";

const serializer = new OrmYamlSerializer();

/**
 * Load entity type names from an ORM model file.
 *
 * @param modelPath - Path to a `.orm.yaml` file.
 * @returns Set of entity type names (PascalCase), or empty set on failure.
 */
export function loadGuidingEntityNames(modelPath: string): ReadonlySet<string> {
  try {
    const yaml = readFileSync(modelPath, "utf8");
    const model = serializer.deserialize(yaml);
    const names = new Set<string>();
    for (const ot of model.objectTypes) {
      if (ot.kind === "entity") {
        names.add(ot.name);
      }
    }
    return names;
  } catch {
    return new Set<string>();
  }
}

/**
 * Filter types to only those whose names appear in the guiding model.
 *
 * When a guiding model is provided, this retains:
 * - Types whose name matches a known entity (case-insensitive)
 * - Enums (always kept -- they may represent value constraints)
 * - Types referenced by kept entities (TBD in enrich pass)
 *
 * When no guiding model is provided (empty set), returns all types.
 */
export function filterByGuidingModel<T extends { readonly name: string; readonly kind: string; }>(
  types: readonly T[],
  guidingNames: ReadonlySet<string>,
): readonly T[] {
  if (guidingNames.size === 0) return types;

  // Build a case-insensitive lookup
  const lowerNames = new Set<string>();
  for (const name of guidingNames) {
    lowerNames.add(name.toLowerCase());
  }

  return types.filter((t) => {
    // Always keep enums -- they are value types that may constrain entities
    if (t.kind === "enum" || t.kind === "type_alias") return true;
    // Keep if name matches a known entity
    return lowerNames.has(t.name.toLowerCase());
  });
}
