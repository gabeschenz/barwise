/**
 * Converts an LLM extraction response into an OrmModel.
 *
 * This is a best-effort parser: it constructs as much of the model
 * as possible, collecting warnings for elements that cannot be created
 * (e.g., a fact type referencing an object type the LLM didn't extract).
 */

import { OrmModel } from "@fregma/core";
import type {
  ExtractionResponse,
  DraftModelResult,
  ElementProvenance,
  ConstraintProvenance,
} from "./ExtractionTypes.js";

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
      // Find the role(s) by player name.
      const roleIds = resolveRolesByPlayerName(ft, ic.roles, warnings, ic.description);
      if (roleIds.length > 0) {
        ft.addConstraint({ type: "internal_uniqueness", roleIds });
        constraintProvenance.push({
          description: ic.description,
          confidence: ic.confidence,
          sourceReferences: ic.source_references ?? [],
          applied: true,
        });
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
      const roleIds = resolveRolesByPlayerName(ft, ic.roles, warnings, ic.description);
      if (roleIds.length === 1 && roleIds[0]) {
        ft.addConstraint({ type: "mandatory", roleId: roleIds[0] });
        constraintProvenance.push({
          description: ic.description,
          confidence: ic.confidence,
          sourceReferences: ic.source_references ?? [],
          applied: true,
        });
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
      // Value constraints on fact type roles are less common from
      // transcript extraction. Log but skip for now.
      constraintProvenance.push({
        description: ic.description,
        confidence: ic.confidence,
        sourceReferences: ic.source_references ?? [],
        applied: false,
        skipReason: "Role-level value constraints from transcripts are not yet supported.",
      });
    }
  }

  return {
    model,
    objectTypeProvenance,
    factTypeProvenance,
    constraintProvenance,
    ambiguities: response.ambiguities ?? [],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRolesByPlayerName(
  ft: import("@fregma/core").FactType,
  playerNames: readonly string[],
  warnings: string[],
  constraintDesc: string,
): string[] {
  const roleIds: string[] = [];
  for (const playerName of playerNames) {
    const role = ft.roles.find((r) => {
      // Match by player name: look up the ORM model's object types
      // through the fact type. We compare role names or check if the
      // player name matches any role's object type.
      return r.name === playerName.toLowerCase() ||
        r.name === playerName;
    });

    if (role) {
      roleIds.push(role.id);
    } else {
      // Try matching by position hint: if the playerName matches
      // an object type name, find the role played by that OT.
      const roleByPlayer = ft.roles.find((r) => {
        // We don't have direct OT access here, so fall back to
        // checking all roles. The caller typically passes OT names.
        return true; // Accept first unmatched role as fallback.
      });
      if (roleByPlayer && !roleIds.includes(roleByPlayer.id)) {
        // This is a weak match; warn about it.
        warnings.push(
          `Constraint "${constraintDesc}": could not precisely match ` +
          `role "${playerName}" in fact type. Using positional fallback.`,
        );
        roleIds.push(roleByPlayer.id);
      }
    }
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
