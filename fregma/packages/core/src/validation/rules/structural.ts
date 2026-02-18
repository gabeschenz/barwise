import type { OrmModel } from "../../model/OrmModel.js";
import type { Diagnostic } from "../Diagnostic.js";

/**
 * Structural validation rules.
 *
 * These check the basic well-formedness of the model:
 * - Every role in every fact type references an object type that exists.
 * - No duplicate object type names.
 * - No duplicate fact type names.
 * - Binary fact types have at least two readings (forward and inverse).
 */
export function structuralRules(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...checkDanglingRoleReferences(model));
  diagnostics.push(...checkDuplicateObjectTypeNames(model));
  diagnostics.push(...checkDuplicateFactTypeNames(model));
  diagnostics.push(...checkBinaryFactTypeReadings(model));

  return diagnostics;
}

/**
 * Every role's playerId must reference an object type that exists
 * in the model.
 */
function checkDanglingRoleReferences(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ft of model.factTypes) {
    for (const role of ft.roles) {
      if (!model.getObjectType(role.playerId)) {
        diagnostics.push({
          severity: "error",
          message:
            `Role "${role.name}" in fact type "${ft.name}" references ` +
            `object type id "${role.playerId}" which does not exist in the model.`,
          elementId: ft.id,
          ruleId: "structural/dangling-role-reference",
        });
      }
    }
  }

  return diagnostics;
}

/**
 * No two object types should share the same name.
 *
 * The OrmModel.addObjectType method already prevents this at construction
 * time, but models loaded from files could have slipped through.
 */
function checkDuplicateObjectTypeNames(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, string>(); // name -> first id

  for (const ot of model.objectTypes) {
    const existing = seen.get(ot.name);
    if (existing) {
      diagnostics.push({
        severity: "error",
        message:
          `Duplicate object type name "${ot.name}". ` +
          `Another object type with this name already exists (id: ${existing}).`,
        elementId: ot.id,
        ruleId: "structural/duplicate-object-type-name",
      });
    } else {
      seen.set(ot.name, ot.id);
    }
  }

  return diagnostics;
}

/**
 * No two fact types should share the same name.
 */
function checkDuplicateFactTypeNames(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, string>();

  for (const ft of model.factTypes) {
    const existing = seen.get(ft.name);
    if (existing) {
      diagnostics.push({
        severity: "error",
        message:
          `Duplicate fact type name "${ft.name}". ` +
          `Another fact type with this name already exists (id: ${existing}).`,
        elementId: ft.id,
        ruleId: "structural/duplicate-fact-type-name",
      });
    } else {
      seen.set(ft.name, ft.id);
    }
  }

  return diagnostics;
}

/**
 * Binary fact types should have at least two readings (forward and inverse).
 * This is a warning, not an error -- a single reading is technically valid
 * but usually indicates the modeler forgot the inverse.
 */
function checkBinaryFactTypeReadings(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ft of model.factTypes) {
    if (ft.arity === 2 && ft.readings.length < 2) {
      diagnostics.push({
        severity: "warning",
        message:
          `Binary fact type "${ft.name}" has only ${ft.readings.length} reading. ` +
          `Binary fact types typically have both a forward and inverse reading.`,
        elementId: ft.id,
        ruleId: "structural/binary-missing-inverse-reading",
      });
    }
  }

  return diagnostics;
}
