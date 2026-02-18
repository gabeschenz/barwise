import type { OrmModel } from "../../model/OrmModel.js";
import type { Diagnostic } from "../Diagnostic.js";

/**
 * Completeness warning rules.
 *
 * These produce informational or warning diagnostics for elements
 * that are technically valid but likely incomplete:
 * - Object types without definitions.
 * - Fact types without any constraints (usually means the modeler
 *   hasn't finished specifying business rules).
 * - Object types not participating in any fact type (isolated types).
 */
export function completenessWarnings(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...checkMissingObjectTypeDefinitions(model));
  diagnostics.push(...checkFactTypesWithoutConstraints(model));
  diagnostics.push(...checkIsolatedObjectTypes(model));

  return diagnostics;
}

/**
 * Object types without a definition are likely incomplete.
 * Definitions are part of the ubiquitous language and should be
 * provided for every concept.
 */
function checkMissingObjectTypeDefinitions(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ot of model.objectTypes) {
    if (!ot.definition) {
      diagnostics.push({
        severity: "info",
        message: `Object type "${ot.name}" has no definition.`,
        elementId: ot.id,
        ruleId: "completeness/missing-object-type-definition",
      });
    }
  }

  return diagnostics;
}

/**
 * Fact types without constraints usually indicate the modeler hasn't
 * finished specifying business rules for that relationship.
 */
function checkFactTypesWithoutConstraints(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ft of model.factTypes) {
    if (ft.constraints.length === 0) {
      diagnostics.push({
        severity: "warning",
        message:
          `Fact type "${ft.name}" has no constraints. ` +
          `Most fact types need at least a uniqueness constraint.`,
        elementId: ft.id,
        ruleId: "completeness/fact-type-without-constraints",
      });
    }
  }

  return diagnostics;
}

/**
 * Object types that do not participate in any fact type are isolated.
 * They may be placeholders that need to be connected, or leftovers
 * from editing.
 */
function checkIsolatedObjectTypes(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ot of model.objectTypes) {
    const participations = model.factTypesForObjectType(ot.id);
    if (participations.length === 0) {
      diagnostics.push({
        severity: "info",
        message:
          `Object type "${ot.name}" does not participate in any fact type.`,
        elementId: ot.id,
        ruleId: "completeness/isolated-object-type",
      });
    }
  }

  return diagnostics;
}
