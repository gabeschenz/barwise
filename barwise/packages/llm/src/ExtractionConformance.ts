/**
 * Deterministic conformance validation for LLM extraction responses.
 *
 * Applies structural checks against ORM 2 invariants to the raw
 * ExtractionResponse before the DraftModelParser consumes it. Fixes
 * issues where possible and records corrections for visibility.
 *
 * All checks are deterministic code -- no LLM calls.
 */

import type {
  ExtractedPopulation,
  ExtractionResponse,
  InferredConstraint,
} from "./ExtractionTypes.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ConformanceCorrection {
  /** Category identifier for the check that triggered this correction. */
  readonly category: string;
  /** Human-readable explanation of what was fixed. */
  readonly description: string;
  /** Name of the affected element (fact type, constraint, etc.). */
  readonly element?: string;
}

export interface ConformanceResult {
  /** The cleaned extraction response. */
  readonly response: ExtractionResponse;
  /** Corrections that were applied. */
  readonly corrections: readonly ConformanceCorrection[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Validate an ExtractionResponse against ORM 2 structural invariants
 * and return a cleaned copy with a report of corrections made.
 */
export function enforceConformance(
  input: ExtractionResponse,
): ConformanceResult {
  const corrections: ConformanceCorrection[] = [];

  const objectTypeNames = new Set(input.object_types.map((ot) => ot.name));
  const factTypeNames = new Set(input.fact_types.map((ft) => ft.name));

  // Build sets for identifier fact type detection. An identifier fact
  // type links an entity (with a reference_mode) to its identifying
  // value type. It must be a binary fact type where one role player is
  // an entity with a reference_mode and the other is a value type.
  const entityRefModes = new Map<string, string>();
  const allEntityNames = new Set<string>();
  const valueTypeNames = new Set<string>();
  for (const ot of input.object_types) {
    if (ot.kind === "entity") {
      allEntityNames.add(ot.name);
      if (ot.reference_mode) {
        entityRefModes.set(ot.name, ot.reference_mode);
      }
    } else {
      valueTypeNames.add(ot.name);
    }
  }

  const identifierFactTypes = new Set<string>();
  const identifierFactTypeEntities = new Set<string>();
  for (const ft of input.fact_types) {
    if (ft.roles.length === 2) {
      const [r0, r1] = ft.roles;
      // An identifier fact type has one entity (with reference_mode)
      // and one value type.
      const r0IsRefEntity = entityRefModes.has(r0!.player);
      const r1IsRefEntity = entityRefModes.has(r1!.player);
      const r0IsValue = valueTypeNames.has(r0!.player);
      const r1IsValue = valueTypeNames.has(r1!.player);
      if (r0IsRefEntity && r1IsValue) {
        identifierFactTypes.add(ft.name);
        identifierFactTypeEntities.add(r0!.player);
      } else if (r1IsRefEntity && r0IsValue) {
        identifierFactTypes.add(ft.name);
        identifierFactTypeEntities.add(r1!.player);
      }
    }
  }

  // --- Check populations ---
  const cleanedPopulations = cleanPopulations(
    input.populations ?? [],
    factTypeNames,
    input,
    corrections,
  );

  // Build the set of valid role identifiers. The parser resolves
  // constraint roles by object type name (player) or by role name,
  // so both are valid.
  const validRoleIdentifiers = new Set(objectTypeNames);
  for (const ft of input.fact_types) {
    for (const role of ft.roles) {
      validRoleIdentifiers.add(role.role_name);
    }
  }

  // --- Check constraints ---
  const cleanedConstraints = cleanConstraints(
    input.inferred_constraints,
    objectTypeNames,
    validRoleIdentifiers,
    identifierFactTypes,
    corrections,
  );

  // --- Check reference_mode without identifier fact type ---
  checkOrphanedReferenceModes(
    entityRefModes,
    identifierFactTypeEntities,
    corrections,
  );

  return {
    response: {
      ...input,
      populations: cleanedPopulations,
      inferred_constraints: cleanedConstraints,
    },
    corrections,
  };
}

// ---------------------------------------------------------------------------
// Population checks
// ---------------------------------------------------------------------------

function cleanPopulations(
  populations: readonly ExtractedPopulation[],
  factTypeNames: Set<string>,
  input: ExtractionResponse,
  corrections: ConformanceCorrection[],
): ExtractedPopulation[] {
  const result: ExtractedPopulation[] = [];

  for (const pop of populations) {
    // Check 1: Empty instances
    if (pop.instances.length === 0) {
      corrections.push({
        category: "empty_population",
        description: `Removed population for "${pop.fact_type}" with no instances.`,
        element: pop.fact_type,
      });
      continue;
    }

    // Check 2: Nonexistent fact type
    if (!factTypeNames.has(pop.fact_type)) {
      corrections.push({
        category: "orphaned_population",
        description: `Removed population referencing nonexistent fact type "${pop.fact_type}".`,
        element: pop.fact_type,
      });
      continue;
    }

    // Check 3: Population duplicating a value constraint
    if (isDuplicateOfValueConstraint(pop, input)) {
      corrections.push({
        category: "duplicate_value_constraint_population",
        description:
          `Removed population for "${pop.fact_type}" that duplicates a value constraint.`,
        element: pop.fact_type,
      });
      continue;
    }

    result.push(pop);
  }

  return result;
}

/**
 * Detect if a population's instances merely repeat the allowed values
 * from a value constraint on one of the fact type's role players.
 */
function isDuplicateOfValueConstraint(
  pop: ExtractedPopulation,
  input: ExtractionResponse,
): boolean {
  // Find the fact type definition.
  const ft = input.fact_types.find((f) => f.name === pop.fact_type);
  if (!ft) return false;

  // For each role player, check if it has a value_constraint.
  for (const role of ft.roles) {
    const ot = input.object_types.find((o) => o.name === role.player);
    if (!ot?.value_constraint?.values?.length) continue;

    const constraintValues = new Set(ot.value_constraint.values);

    // Check if all population instance values for this role player
    // are a subset of the value constraint.
    const popValues = new Set<string>();
    for (const instance of pop.instances) {
      const val = instance.role_values[role.player];
      if (val !== undefined) {
        popValues.add(val);
      }
    }

    if (popValues.size > 0 && isSubsetOf(popValues, constraintValues)) {
      return true;
    }
  }

  return false;
}

function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
  for (const val of a) {
    if (!b.has(val)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Constraint checks
// ---------------------------------------------------------------------------

function cleanConstraints(
  constraints: readonly InferredConstraint[],
  objectTypeNames: Set<string>,
  validRoleIdentifiers: Set<string>,
  identifierFactTypes: Set<string>,
  corrections: ConformanceCorrection[],
): InferredConstraint[] {
  const result: InferredConstraint[] = [];
  const seen = new Set<string>();

  for (const ic of constraints) {
    // Check 4: Role identifiers must be resolvable. The parser accepts
    // both object type names (player names) and role names, so we
    // accept either form here.
    const invalidPlayers = ic.roles.filter((r) => !validRoleIdentifiers.has(r));
    if (invalidPlayers.length > 0) {
      corrections.push({
        category: "invalid_role_player",
        description: `Removed constraint "${ic.description}" -- role identifier(s) ${
          invalidPlayers.map((p) => `"${p}"`).join(", ")
        } not resolvable.`,
        element: ic.fact_type,
      });
      continue;
    }

    // Check 5: Constraint arity
    if (!isValidArity(ic)) {
      corrections.push({
        category: "arity_mismatch",
        description: `Removed constraint "${ic.description}" -- ${ic.type} requires ${
          expectedArityDescription(ic.type)
        } role(s) but got ${ic.roles.length}.`,
        element: ic.fact_type,
      });
      continue;
    }

    // Check 6: is_preferred on non-identifier fact type
    let constraint = ic;
    if (ic.is_preferred && !identifierFactTypes.has(ic.fact_type)) {
      corrections.push({
        category: "misplaced_is_preferred",
        description:
          `Cleared is_preferred on constraint "${ic.description}" -- fact type "${ic.fact_type}" is not an identifier fact type.`,
        element: ic.fact_type,
      });
      // Create a copy without is_preferred
      constraint = {
        type: ic.type,
        fact_type: ic.fact_type,
        roles: ic.roles,
        description: ic.description,
        confidence: ic.confidence,
        values: ic.values,
        ring_type: ic.ring_type,
        min: ic.min,
        max: ic.max,
        superset_fact_type: ic.superset_fact_type,
        superset_roles: ic.superset_roles,
        source_references: ic.source_references,
      };
    }

    // Check 7: Duplicate constraints
    const key = constraintKey(constraint);
    if (seen.has(key)) {
      corrections.push({
        category: "duplicate_constraint",
        description:
          `Removed duplicate constraint "${constraint.description}" (${constraint.type} on ${constraint.fact_type}).`,
        element: constraint.fact_type,
      });
      continue;
    }
    seen.add(key);

    result.push(constraint);
  }

  return result;
}

function isValidArity(ic: InferredConstraint): boolean {
  switch (ic.type) {
    case "ring":
      return ic.roles.length === 2;
    case "frequency":
    case "mandatory":
      return ic.roles.length === 1;
    default:
      // Other constraint types accept 1 or more roles.
      return ic.roles.length >= 1;
  }
}

function expectedArityDescription(type: InferredConstraint["type"]): string {
  switch (type) {
    case "ring":
      return "exactly 2";
    case "frequency":
    case "mandatory":
      return "exactly 1";
    default:
      return "at least 1";
  }
}

function constraintKey(ic: InferredConstraint): string {
  const sortedRoles = [...ic.roles].sort().join(",");
  return `${ic.type}|${ic.fact_type}|${sortedRoles}`;
}

// ---------------------------------------------------------------------------
// Reference mode checks
// ---------------------------------------------------------------------------

function checkOrphanedReferenceModes(
  entityRefModes: Map<string, string>,
  identifierFactTypeEntities: Set<string>,
  corrections: ConformanceCorrection[],
): void {
  // Check 8: Entity has reference_mode but no identifier fact type
  for (const [entityName] of entityRefModes) {
    if (!identifierFactTypeEntities.has(entityName)) {
      corrections.push({
        category: "orphaned_reference_mode",
        description:
          `Entity "${entityName}" has a reference_mode but no identifier fact type was found.`,
        element: entityName,
      });
    }
  }
}
