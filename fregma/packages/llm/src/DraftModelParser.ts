/**
 * Converts an LLM extraction response into an OrmModel.
 *
 * This is a best-effort parser: it constructs as much of the model
 * as possible, collecting warnings for elements that cannot be created
 * (e.g., a fact type referencing an object type the LLM didn't extract).
 */

import { OrmModel } from "@fregma/core";
import type { ConceptualDataTypeName, DataTypeDef } from "@fregma/core";
import type {
  ExtractionResponse,
  DraftModelResult,
  ElementProvenance,
  ConstraintProvenance,
  SubtypeProvenance,
} from "./ExtractionTypes.js";

/** Valid ConceptualDataTypeName values for validation of LLM output. */
const VALID_DATA_TYPE_NAMES: ReadonlySet<string> = new Set<ConceptualDataTypeName>([
  "text", "integer", "decimal", "money", "float", "boolean",
  "date", "time", "datetime", "timestamp", "auto_counter",
  "binary", "uuid", "other",
]);

/**
 * Parse an extraction response into an ORM model with provenance metadata.
 *
 * @param response - The structured extraction from the LLM
 * @param modelName - Name for the resulting model
 */
export function parseDraftModel(
  response: ExtractionResponse,
  modelName: string,
): DraftModelResult {
  const model = new OrmModel({ name: modelName });
  const warnings: string[] = [];
  const objectTypeProvenance: ElementProvenance[] = [];
  const factTypeProvenance: ElementProvenance[] = [];
  const subtypeProvenance: SubtypeProvenance[] = [];
  const constraintProvenance: ConstraintProvenance[] = [];

  // Pass 1: Create object types.
  for (const ext of response.object_types) {
    if (!ext.name || ext.name.trim().length === 0) {
      warnings.push("Skipped object type with empty name.");
      continue;
    }

    try {
      model.addObjectType({
        name: ext.name,
        kind: ext.kind ?? "entity",
        referenceMode: ext.kind === "entity"
          ? (ext.reference_mode ?? `${camelCase(ext.name)}_id`)
          : undefined,
        definition: ext.definition,
        valueConstraint: ext.value_constraint?.values?.length
          ? { values: [...ext.value_constraint.values] }
          : undefined,
        dataType: resolveDataType(ext.data_type, ext.name, warnings),
      });

      objectTypeProvenance.push({
        elementName: ext.name,
        sourceReferences: ext.source_references ?? [],
      });
    } catch (err) {
      warnings.push(
        `Failed to create object type "${ext.name}": ${(err as Error).message}`,
      );
    }
  }

  // Pass 2: Create fact types.
  for (const ext of response.fact_types) {
    if (!ext.name || ext.name.trim().length === 0) {
      warnings.push("Skipped fact type with empty name.");
      continue;
    }

    if (!ext.roles || ext.roles.length === 0) {
      warnings.push(`Skipped fact type "${ext.name}": no roles defined.`);
      continue;
    }

    // Resolve role player names to object type ids.
    const resolvedRoles: Array<{ name: string; playerId: string }> = [];
    let resolutionFailed = false;

    for (const role of ext.roles) {
      const ot = model.getObjectTypeByName(role.player);
      if (!ot) {
        warnings.push(
          `Fact type "${ext.name}": role player "${role.player}" ` +
          `not found among extracted object types. Skipping this fact type.`,
        );
        resolutionFailed = true;
        break;
      }
      resolvedRoles.push({
        name: role.role_name || role.player.toLowerCase(),
        playerId: ot.id,
      });
    }

    if (resolutionFailed) continue;

    // Ensure at least one reading exists.
    let readings = ext.readings?.length
      ? [...ext.readings]
      : [buildDefaultReading(resolvedRoles)];

    // Validate reading placeholders match role count.
    readings = readings.filter((r) => {
      const maxPlaceholder = resolvedRoles.length - 1;
      for (let i = 0; i <= maxPlaceholder; i++) {
        if (!r.includes(`{${i}}`)) {
          warnings.push(
            `Fact type "${ext.name}": reading "${r}" is missing ` +
            `placeholder {${i}}. Discarding this reading.`,
          );
          return false;
        }
      }
      return true;
    });

    if (readings.length === 0) {
      readings = [buildDefaultReading(resolvedRoles)];
    }

    try {
      model.addFactType({
        name: ext.name,
        roles: resolvedRoles.map((r) => ({
          name: r.name,
          playerId: r.playerId,
        })),
        readings,
      });

      factTypeProvenance.push({
        elementName: ext.name,
        sourceReferences: ext.source_references ?? [],
      });
    } catch (err) {
      warnings.push(
        `Failed to create fact type "${ext.name}": ${(err as Error).message}`,
      );
    }
  }

  // Pass 3: Apply inferred constraints.
  for (const ic of response.inferred_constraints) {
    const ft = model.getFactTypeByName(ic.fact_type);
    if (!ft) {
      constraintProvenance.push({
        description: ic.description,
        confidence: ic.confidence,
        sourceReferences: ic.source_references ?? [],
        applied: false,
        skipReason: `Fact type "${ic.fact_type}" not found in model.`,
      });
      continue;
    }

    if (ic.type === "internal_uniqueness") {
      // Find the role(s) by player name or role name.
      const roleIds = resolveRolesByPlayerName(ft, ic.roles, model, warnings, ic.description);
      if (roleIds.length > 0) {
        const constraint: import("@fregma/core").Constraint = ic.is_preferred
          ? { type: "internal_uniqueness", roleIds, isPreferred: true }
          : { type: "internal_uniqueness", roleIds };

        // Skip duplicate constraints (LLMs often emit the same constraint
        // in multiple phrasings, e.g. "each X has at most one Y" and
        // "each Y identifies at most one X" both targeting the same role).
        if (isDuplicateConstraint(ft, constraint)) {
          constraintProvenance.push({
            description: ic.description,
            confidence: ic.confidence,
            sourceReferences: ic.source_references ?? [],
            applied: false,
            skipReason: "Duplicate constraint (identical type and roles already present).",
          });
        } else {
          ft.addConstraint(constraint);
          constraintProvenance.push({
            description: ic.description,
            confidence: ic.confidence,
            sourceReferences: ic.source_references ?? [],
            applied: true,
          });
        }
      } else {
        constraintProvenance.push({
          description: ic.description,
          confidence: ic.confidence,
          sourceReferences: ic.source_references ?? [],
          applied: false,
          skipReason: `Could not resolve roles [${ic.roles.join(", ")}] in fact type "${ic.fact_type}".`,
        });
      }
    } else if (ic.type === "mandatory") {
      const roleIds = resolveRolesByPlayerName(ft, ic.roles, model, warnings, ic.description);
      if (roleIds.length === 1 && roleIds[0]) {
        const mandatoryConstraint: import("@fregma/core").Constraint = {
          type: "mandatory",
          roleId: roleIds[0],
        };
        if (isDuplicateConstraint(ft, mandatoryConstraint)) {
          constraintProvenance.push({
            description: ic.description,
            confidence: ic.confidence,
            sourceReferences: ic.source_references ?? [],
            applied: false,
            skipReason: "Duplicate constraint (identical type and role already present).",
          });
        } else {
          ft.addConstraint(mandatoryConstraint);
          constraintProvenance.push({
            description: ic.description,
            confidence: ic.confidence,
            sourceReferences: ic.source_references ?? [],
            applied: true,
          });
        }
      } else {
        constraintProvenance.push({
          description: ic.description,
          confidence: ic.confidence,
          sourceReferences: ic.source_references ?? [],
          applied: false,
          skipReason: roleIds.length === 0
            ? `Could not resolve role [${ic.roles.join(", ")}] in fact type "${ic.fact_type}".`
            : `Mandatory constraint requires exactly one role, got ${roleIds.length}.`,
        });
      }
    } else if (ic.type === "value_constraint") {
      // Role-level value constraint: restrict allowed values for a
      // specific role within a fact type.
      if (!ic.values || ic.values.length === 0) {
        constraintProvenance.push({
          description: ic.description,
          confidence: ic.confidence,
          sourceReferences: ic.source_references ?? [],
          applied: false,
          skipReason: "Value constraint has no values specified.",
        });
        continue;
      }

      const roleIds = resolveRolesByPlayerName(ft, ic.roles, model, warnings, ic.description);
      if (roleIds.length !== 1) {
        constraintProvenance.push({
          description: ic.description,
          confidence: ic.confidence,
          sourceReferences: ic.source_references ?? [],
          applied: false,
          skipReason: roleIds.length === 0
            ? `Could not resolve role [${ic.roles.join(", ")}] in fact type "${ic.fact_type}".`
            : `Value constraint requires exactly one role, got ${roleIds.length}.`,
        });
      } else {
        const vcConstraint: import("@fregma/core").Constraint = {
          type: "value_constraint",
          roleId: roleIds[0]!,
          values: [...ic.values],
        };
        if (isDuplicateConstraint(ft, vcConstraint)) {
          constraintProvenance.push({
            description: ic.description,
            confidence: ic.confidence,
            sourceReferences: ic.source_references ?? [],
            applied: false,
            skipReason: "Duplicate constraint (identical value constraint on same role already present).",
          });
        } else {
          ft.addConstraint(vcConstraint);
          constraintProvenance.push({
            description: ic.description,
            confidence: ic.confidence,
            sourceReferences: ic.source_references ?? [],
            applied: true,
          });
        }
      }
    }
  }

  // Pass 4: Create subtype facts.
  for (const ext of response.subtypes ?? []) {
    const subtypeOt = model.getObjectTypeByName(ext.subtype);
    if (!subtypeOt) {
      subtypeProvenance.push({
        subtype: ext.subtype,
        supertype: ext.supertype,
        sourceReferences: ext.source_references ?? [],
        applied: false,
        skipReason: `Subtype entity "${ext.subtype}" not found among extracted object types.`,
      });
      continue;
    }

    const supertypeOt = model.getObjectTypeByName(ext.supertype);
    if (!supertypeOt) {
      subtypeProvenance.push({
        subtype: ext.subtype,
        supertype: ext.supertype,
        sourceReferences: ext.source_references ?? [],
        applied: false,
        skipReason: `Supertype entity "${ext.supertype}" not found among extracted object types.`,
      });
      continue;
    }

    if (subtypeOt.kind !== "entity") {
      subtypeProvenance.push({
        subtype: ext.subtype,
        supertype: ext.supertype,
        sourceReferences: ext.source_references ?? [],
        applied: false,
        skipReason: `Subtype "${ext.subtype}" is a ${subtypeOt.kind} type, not an entity type.`,
      });
      continue;
    }

    if (supertypeOt.kind !== "entity") {
      subtypeProvenance.push({
        subtype: ext.subtype,
        supertype: ext.supertype,
        sourceReferences: ext.source_references ?? [],
        applied: false,
        skipReason: `Supertype "${ext.supertype}" is a ${supertypeOt.kind} type, not an entity type.`,
      });
      continue;
    }

    try {
      model.addSubtypeFact({
        subtypeId: subtypeOt.id,
        supertypeId: supertypeOt.id,
        providesIdentification: ext.provides_identification ?? true,
      });

      subtypeProvenance.push({
        subtype: ext.subtype,
        supertype: ext.supertype,
        sourceReferences: ext.source_references ?? [],
        applied: true,
      });
    } catch (err) {
      subtypeProvenance.push({
        subtype: ext.subtype,
        supertype: ext.supertype,
        sourceReferences: ext.source_references ?? [],
        applied: false,
        skipReason: `Failed to create subtype fact: ${(err as Error).message}`,
      });
    }
  }

  return {
    model,
    objectTypeProvenance,
    factTypeProvenance,
    subtypeProvenance,
    constraintProvenance,
    ambiguities: response.ambiguities ?? [],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a structurally identical constraint already exists on a fact type.
 * Two internal_uniqueness constraints are duplicates if they cover the same set
 * of role IDs. The isPreferred flag is promoted (if either is preferred, the
 * existing one wins).
 */
function isDuplicateConstraint(
  ft: import("@fregma/core").FactType,
  candidate: import("@fregma/core").Constraint,
): boolean {
  if (candidate.type === "internal_uniqueness") {
    const candidateRoles = [...candidate.roleIds].sort();
    return ft.constraints.some((existing) => {
      if (existing.type !== "internal_uniqueness") return false;
      const existingRoles = [...existing.roleIds].sort();
      return (
        existingRoles.length === candidateRoles.length &&
        existingRoles.every((id, i) => id === candidateRoles[i])
      );
    });
  }
  if (candidate.type === "mandatory") {
    return ft.constraints.some(
      (existing) =>
        existing.type === "mandatory" &&
        existing.roleId === candidate.roleId,
    );
  }
  if (candidate.type === "value_constraint") {
    return ft.constraints.some(
      (existing) =>
        existing.type === "value_constraint" &&
        existing.roleId === candidate.roleId,
    );
  }
  return false;
}

/**
 * Resolve role identifiers from constraint role hints.
 *
 * The LLM may send role names ("is placed by"), player names
 * ("Customer"), or a mix. We try matching strategies in order:
 *   1. Exact role name match (case-insensitive)
 *   2. Player object type name match (via model lookup)
 *   3. Skip with warning (no blind fallback)
 */
function resolveRolesByPlayerName(
  ft: import("@fregma/core").FactType,
  roleHints: readonly string[],
  model: OrmModel,
  warnings: string[],
  constraintDesc: string,
): string[] {
  const roleIds: string[] = [];
  for (const hint of roleHints) {
    const hintLower = hint.toLowerCase();

    // Strategy 1: Match by role name (case-insensitive).
    const byRoleName = ft.roles.find(
      (r) => r.name.toLowerCase() === hintLower && !roleIds.includes(r.id),
    );
    if (byRoleName) {
      roleIds.push(byRoleName.id);
      continue;
    }

    // Strategy 2: Match by player object type name.
    const ot = model.getObjectTypeByName(hint);
    if (ot) {
      const candidates = ft.rolesForPlayer(ot.id)
        .filter((r) => !roleIds.includes(r.id));
      if (candidates.length > 0) {
        roleIds.push(candidates[0]!.id);
        continue;
      }
    }

    // No match found -- warn but do not blindly pick a role.
    warnings.push(
      `Constraint "${constraintDesc}": could not resolve ` +
      `role "${hint}" in fact type "${ft.name}". Skipping this role.`,
    );
  }
  return roleIds;
}

function camelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function buildDefaultReading(
  roles: Array<{ name: string; playerId: string }>,
): string {
  // Build "{0} role_name_1 {1} role_name_2 {2}" etc.
  const parts: string[] = [];
  for (let i = 0; i < roles.length; i++) {
    parts.push(`{${i}}`);
    const role = roles[i]!;
    if (i < roles.length - 1) {
      parts.push(role.name);
    }
  }
  return parts.join(" ");
}

/**
 * Validate and convert an LLM-produced data_type into a DataTypeDef.
 * Returns undefined if the input is missing or has an unrecognized type name.
 */
function resolveDataType(
  raw: { readonly name: string; readonly length?: number; readonly scale?: number } | undefined,
  objectTypeName: string,
  warnings: string[],
): DataTypeDef | undefined {
  if (!raw?.name) return undefined;

  if (!VALID_DATA_TYPE_NAMES.has(raw.name)) {
    warnings.push(
      `Object type "${objectTypeName}": unrecognized data type "${raw.name}". Ignoring.`,
    );
    return undefined;
  }

  const result: DataTypeDef = { name: raw.name as ConceptualDataTypeName };
  if (raw.length !== undefined && typeof raw.length === "number") {
    (result as { length: number }).length = raw.length;
  }
  if (raw.scale !== undefined && typeof raw.scale === "number") {
    (result as { scale: number }).scale = raw.scale;
  }
  return result;
}
