import type { OrmModel } from "../../model/OrmModel.js";
import type { Diagnostic } from "../Diagnostic.js";
import type { FactInstance } from "../../model/Population.js";
import {
  isInternalUniqueness,
  isValueConstraint,
  isFrequency,
} from "../../model/Constraint.js";

/**
 * Population validation rules.
 *
 * These check sample fact instances against the constraints declared
 * on their fact types:
 *
 * - Dangling fact type reference: population references a nonexistent fact type.
 * - Internal uniqueness violations: duplicate tuples for the constrained role set.
 * - Value constraint violations: instance values not in the allowed set.
 * - Frequency violations: a role is played too few or too many times.
 *
 * Note: Mandatory constraint validation is not included here because it
 * requires cross-fact-type population analysis (knowing the full universe
 * of entity instances). That is deferred to a future enhancement.
 */
export function populationValidationRules(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...checkDanglingPopulationFactType(model));
  diagnostics.push(...checkUniquenessViolations(model));
  diagnostics.push(...checkValueConstraintViolations(model));
  diagnostics.push(...checkFrequencyViolations(model));

  return diagnostics;
}

/**
 * Every population must reference a fact type that exists in the model.
 */
function checkDanglingPopulationFactType(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const pop of model.populations) {
    if (!model.getFactType(pop.factTypeId)) {
      diagnostics.push({
        severity: "error",
        message:
          `Population "${pop.id}" references fact type id "${pop.factTypeId}" ` +
          `which does not exist in the model.`,
        elementId: pop.id,
        ruleId: "population/dangling-fact-type",
      });
    }
  }

  return diagnostics;
}

/**
 * Internal uniqueness constraints require that the combination of values
 * for the specified roles is unique across all instances in the population.
 */
function checkUniquenessViolations(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const pop of model.populations) {
    const ft = model.getFactType(pop.factTypeId);
    if (!ft) continue;

    const uniquenessConstraints = ft.constraints.filter(isInternalUniqueness);
    for (const uc of uniquenessConstraints) {
      const seen = new Map<string, string>(); // composite key -> first instance id

      for (const inst of pop.instances) {
        const key = makeCompositeKey(inst, uc.roleIds);
        const firstId = seen.get(key);
        if (firstId) {
          diagnostics.push({
            severity: "error",
            message:
              `Population "${pop.id}": instance "${inst.id}" violates ` +
              `internal uniqueness constraint on role(s) [${uc.roleIds.join(", ")}]. ` +
              `Duplicate of instance "${firstId}".`,
            elementId: pop.id,
            ruleId: "population/uniqueness-violation",
          });
        } else {
          seen.set(key, inst.id);
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Value constraints restrict what values a role may hold.
 * Each instance value for the constrained role must be in the allowed set.
 */
function checkValueConstraintViolations(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const pop of model.populations) {
    const ft = model.getFactType(pop.factTypeId);
    if (!ft) continue;

    const valueConstraints = ft.constraints.filter(isValueConstraint);
    for (const vc of valueConstraints) {
      if (!vc.roleId) continue; // Type-level value constraints (no specific role)
      const allowedSet = new Set(vc.values);

      for (const inst of pop.instances) {
        const val = inst.values[vc.roleId];
        if (val !== undefined && !allowedSet.has(val)) {
          diagnostics.push({
            severity: "error",
            message:
              `Population "${pop.id}": instance "${inst.id}" has value ` +
              `"${val}" for role "${vc.roleId}" which is not in the ` +
              `allowed set [${vc.values.join(", ")}].`,
            elementId: pop.id,
            ruleId: "population/value-constraint-violation",
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Frequency constraints restrict how many times an object may play a role.
 * For each distinct value in the constrained role, count how many instances
 * have that value and check against the min/max bounds.
 */
function checkFrequencyViolations(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const pop of model.populations) {
    const ft = model.getFactType(pop.factTypeId);
    if (!ft) continue;

    const frequencyConstraints = ft.constraints.filter(isFrequency);
    for (const fc of frequencyConstraints) {
      // Count occurrences of each distinct value in the constrained role.
      const counts = new Map<string, number>();
      for (const inst of pop.instances) {
        const val = inst.values[fc.roleId];
        if (val !== undefined) {
          counts.set(val, (counts.get(val) ?? 0) + 1);
        }
      }

      for (const [val, count] of counts) {
        if (count < fc.min) {
          diagnostics.push({
            severity: "error",
            message:
              `Population "${pop.id}": value "${val}" in role "${fc.roleId}" ` +
              `appears ${count} time(s) but the minimum is ${fc.min}.`,
            elementId: pop.id,
            ruleId: "population/frequency-violation",
          });
        }
        if (fc.max !== "unbounded" && count > fc.max) {
          diagnostics.push({
            severity: "error",
            message:
              `Population "${pop.id}": value "${val}" in role "${fc.roleId}" ` +
              `appears ${count} time(s) but the maximum is ${fc.max}.`,
            elementId: pop.id,
            ruleId: "population/frequency-violation",
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Create a composite key from an instance's values for the given role ids.
 * Used for uniqueness checking.
 */
function makeCompositeKey(
  inst: FactInstance,
  roleIds: readonly string[],
): string {
  return roleIds.map((rid) => inst.values[rid] ?? "").join("\0");
}
