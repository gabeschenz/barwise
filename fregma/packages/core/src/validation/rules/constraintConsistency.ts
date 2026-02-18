import type { OrmModel } from "../../model/OrmModel.js";
import type { Diagnostic } from "../Diagnostic.js";

/**
 * Constraint consistency rules.
 *
 * These verify that constraints reference valid roles and are
 * logically coherent:
 * - Internal uniqueness constraints reference roles within their fact type.
 * - Mandatory constraints reference a role within their fact type.
 * - Value constraints (role-level) reference a role within their fact type.
 * - Internal uniqueness constraints do not span all roles of a fact type
 *   with arity > 1 (spanning uniqueness on all roles is redundant).
 */
export function constraintConsistencyRules(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ft of model.factTypes) {
    for (const constraint of ft.constraints) {
      switch (constraint.type) {
        case "internal_uniqueness": {
          // Every referenced role must belong to this fact type.
          for (const roleId of constraint.roleIds) {
            if (!ft.hasRole(roleId)) {
              diagnostics.push({
                severity: "error",
                message:
                  `Internal uniqueness constraint in fact type "${ft.name}" ` +
                  `references role id "${roleId}" which does not belong to this fact type.`,
                elementId: ft.id,
                ruleId: "constraint/internal-uniqueness-invalid-role",
              });
            }
          }

          // Warn if uniqueness spans all roles in a multi-role fact type.
          if (
            constraint.roleIds.length === ft.arity &&
            ft.arity > 1 &&
            constraint.roleIds.every((rid) => ft.hasRole(rid))
          ) {
            diagnostics.push({
              severity: "warning",
              message:
                `Internal uniqueness constraint in fact type "${ft.name}" ` +
                `spans all ${ft.arity} roles. This means each complete fact ` +
                `can only appear once, which is often redundant.`,
              elementId: ft.id,
              ruleId: "constraint/spanning-all-roles",
            });
          }
          break;
        }

        case "mandatory": {
          if (!ft.hasRole(constraint.roleId)) {
            diagnostics.push({
              severity: "error",
              message:
                `Mandatory constraint in fact type "${ft.name}" ` +
                `references role id "${constraint.roleId}" which does not belong to this fact type.`,
              elementId: ft.id,
              ruleId: "constraint/mandatory-invalid-role",
            });
          }
          break;
        }

        case "value_constraint": {
          if (constraint.roleId && !ft.hasRole(constraint.roleId)) {
            diagnostics.push({
              severity: "error",
              message:
                `Value constraint in fact type "${ft.name}" ` +
                `references role id "${constraint.roleId}" which does not belong to this fact type.`,
              elementId: ft.id,
              ruleId: "constraint/value-constraint-invalid-role",
            });
          }
          break;
        }

        case "external_uniqueness": {
          // At least some of the roles should NOT belong to this fact type
          // (external uniqueness spans multiple fact types). If all roles
          // belong to this fact type, it should be internal uniqueness.
          const allLocal = constraint.roleIds.every((rid) =>
            ft.hasRole(rid),
          );
          if (allLocal) {
            diagnostics.push({
              severity: "warning",
              message:
                `External uniqueness constraint in fact type "${ft.name}" ` +
                `references only roles within this fact type. ` +
                `Consider using internal uniqueness instead.`,
              elementId: ft.id,
              ruleId: "constraint/external-uniqueness-all-local",
            });
          }
          break;
        }
      }
    }
  }

  return diagnostics;
}
