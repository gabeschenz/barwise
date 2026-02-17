/**
 * Phase 1 ORM constraint types.
 *
 * These cover the most common modeling patterns and are sufficient for
 * the majority of real-world data warehouse models.
 */

/**
 * Internal uniqueness constraint.
 *
 * Applies to one or more roles within a single fact type. The combination
 * of values in the specified roles is unique across the population.
 *
 * Single-role example: "Each Order is placed by at most one Customer"
 *   -> uniqueness on the Order role of "Customer places Order"
 *
 * Multi-role example: "Each Employee, Date combination maps to at most one Shift"
 *   -> uniqueness spanning Employee and Date roles in a ternary fact type
 */
export interface InternalUniquenessConstraint {
  readonly type: "internal_uniqueness";
  /** Role ids within the same fact type. */
  readonly roleIds: readonly string[];
}

/**
 * Mandatory role constraint.
 *
 * Every instance of the object type playing this role must participate
 * in the fact type.
 *
 * Example: "Every Order is placed by some Customer"
 *   -> mandatory on the Order role of "Customer places Order"
 */
export interface MandatoryRoleConstraint {
  readonly type: "mandatory";
  /** The single role id that is mandatory. */
  readonly roleId: string;
}

/**
 * External uniqueness constraint.
 *
 * Uniqueness across a combination of roles from different fact types.
 * The object type playing the roles must be the same across all
 * referenced fact types.
 *
 * Example: An Employee is uniquely identified by their combination
 * of FirstName and LastName (if those are separate fact types).
 */
export interface ExternalUniquenessConstraint {
  readonly type: "external_uniqueness";
  /** Role ids spanning multiple fact types. */
  readonly roleIds: readonly string[];
}

/**
 * Value constraint.
 *
 * Restricts the allowed values for a value type or a specific role.
 * Currently supports enumerated values.
 *
 * Example: "Rating must be one of: A, B, C, D, F"
 */
export interface ValueConstraint {
  readonly type: "value_constraint";
  /** The role id this constraint applies to (if role-level). */
  readonly roleId?: string;
  /** Allowed values. */
  readonly values: readonly string[];
}

/**
 * Union of all Phase 1 constraint types.
 */
export type Constraint =
  | InternalUniquenessConstraint
  | MandatoryRoleConstraint
  | ExternalUniquenessConstraint
  | ValueConstraint;

/**
 * Discriminated union type guard helpers.
 */
export function isInternalUniqueness(
  c: Constraint,
): c is InternalUniquenessConstraint {
  return c.type === "internal_uniqueness";
}

export function isMandatoryRole(
  c: Constraint,
): c is MandatoryRoleConstraint {
  return c.type === "mandatory";
}

export function isExternalUniqueness(
  c: Constraint,
): c is ExternalUniquenessConstraint {
  return c.type === "external_uniqueness";
}

export function isValueConstraint(c: Constraint): c is ValueConstraint {
  return c.type === "value_constraint";
}
