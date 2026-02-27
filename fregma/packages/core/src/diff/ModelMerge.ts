/**
 * Model merge: applies a set of accepted deltas to an existing model.
 *
 * Design principles:
 * - Accepted "added" elements use the incoming element as-is.
 * - Accepted "modified" elements keep the existing UUID but take the
 *   incoming element's content, so downstream references stay valid.
 * - Accepted "removed" elements are omitted from the output.
 * - Rejected deltas leave the existing element unchanged.
 * - "unchanged" deltas always keep the existing element.
 *
 * Returns a freshly constructed OrmModel (no mutation of inputs).
 */

import { OrmModel } from "../model/OrmModel.js";
import type { FactTypeConfig } from "../model/FactType.js";
import type { RoleConfig } from "../model/Role.js";
import type {
  ModelDelta,
  ObjectTypeDelta,
  FactTypeDelta,
  DefinitionDelta,
} from "./ModelDiff.js";

/**
 * Build a merged OrmModel from the existing model plus a set of accepted
 * delta indices.
 *
 * @param existing  The current model on disk.
 * @param incoming  The freshly extracted model (source of new content).
 * @param deltas    The full diff result.
 * @param accepted  Set of indices into `deltas` that the user accepted.
 */
export function mergeModels(
  existing: OrmModel,
  incoming: OrmModel,
  deltas: readonly ModelDelta[],
  accepted: ReadonlySet<number>,
): OrmModel {
  const merged = new OrmModel({
    name: existing.name,
    domainContext: existing.domainContext,
  });

  // We need to build a mapping from incoming object type ids to the ids
  // that will be used in the merged model. This is necessary because
  // fact type roles reference object type ids, and when we accept an
  // "added" object type from the incoming model, its id becomes the
  // canonical one. When we keep an existing object type (unchanged or
  // rejected modification), its id is the canonical one.
  const incomingIdToMergedId = new Map<string, string>();

  // Phase 1: object types (must be added before fact types).
  const otDeltas = deltas
    .map((d, i) => [d, i] as const)
    .filter(([d]) => d.elementType === "object_type") as [ObjectTypeDelta, number][];

  for (const [delta, idx] of otDeltas) {
    const isAccepted = accepted.has(idx);

    if (delta.kind === "unchanged") {
      // Always keep.
      const ot = delta.existing!;
      merged.addObjectType({
        name: ot.name,
        id: ot.id,
        kind: ot.kind,
        referenceMode: ot.referenceMode,
        definition: ot.definition,
        sourceContext: ot.sourceContext,
        valueConstraint: ot.valueConstraint,
        dataType: ot.dataType,
      });
      if (delta.incoming) {
        incomingIdToMergedId.set(delta.incoming.id, ot.id);
      }
    } else if (delta.kind === "added") {
      if (isAccepted) {
        const ot = delta.incoming!;
        merged.addObjectType({
          name: ot.name,
          id: ot.id,
          kind: ot.kind,
          referenceMode: ot.referenceMode,
          definition: ot.definition,
          sourceContext: ot.sourceContext,
          valueConstraint: ot.valueConstraint,
          dataType: ot.dataType,
        });
        incomingIdToMergedId.set(ot.id, ot.id);
      }
      // If rejected: simply omit.
    } else if (delta.kind === "removed") {
      if (!isAccepted) {
        // Rejected removal -> keep the existing element.
        const ot = delta.existing!;
        merged.addObjectType({
          name: ot.name,
          id: ot.id,
          kind: ot.kind,
          referenceMode: ot.referenceMode,
          definition: ot.definition,
          sourceContext: ot.sourceContext,
          valueConstraint: ot.valueConstraint,
          dataType: ot.dataType,
        });
      }
      // If accepted: omit (remove).
    } else if (delta.kind === "modified") {
      if (isAccepted) {
        // Keep existing id, take incoming content.
        const existingOt = delta.existing!;
        const incomingOt = delta.incoming!;
        merged.addObjectType({
          name: incomingOt.name,
          id: existingOt.id,
          kind: incomingOt.kind,
          referenceMode: incomingOt.referenceMode,
          definition: incomingOt.definition,
          sourceContext: incomingOt.sourceContext,
          valueConstraint: incomingOt.valueConstraint,
          dataType: incomingOt.dataType,
        });
        incomingIdToMergedId.set(incomingOt.id, existingOt.id);
      } else {
        // Rejected: keep existing as-is.
        const ot = delta.existing!;
        merged.addObjectType({
          name: ot.name,
          id: ot.id,
          kind: ot.kind,
          referenceMode: ot.referenceMode,
          definition: ot.definition,
          sourceContext: ot.sourceContext,
          valueConstraint: ot.valueConstraint,
          dataType: ot.dataType,
        });
        if (delta.incoming) {
          incomingIdToMergedId.set(delta.incoming.id, ot.id);
        }
      }
    }
  }

  // Phase 2: fact types.
  const ftDeltas = deltas
    .map((d, i) => [d, i] as const)
    .filter(([d]) => d.elementType === "fact_type") as [FactTypeDelta, number][];

  for (const [delta, idx] of ftDeltas) {
    const isAccepted = accepted.has(idx);

    if (delta.kind === "unchanged") {
      addFactTypeToMerged(merged, delta.existing!, null, incomingIdToMergedId);
    } else if (delta.kind === "added") {
      if (isAccepted) {
        addFactTypeToMerged(merged, delta.incoming!, null, incomingIdToMergedId);
      }
    } else if (delta.kind === "removed") {
      if (!isAccepted) {
        addFactTypeToMerged(merged, delta.existing!, null, incomingIdToMergedId);
      }
    } else if (delta.kind === "modified") {
      if (isAccepted) {
        // Keep existing id, take incoming content.
        addFactTypeToMerged(
          merged,
          delta.incoming!,
          delta.existing!.id,
          incomingIdToMergedId,
        );
      } else {
        addFactTypeToMerged(merged, delta.existing!, null, incomingIdToMergedId);
      }
    }
  }

  // Phase 3: definitions.
  const defDeltas = deltas
    .map((d, i) => [d, i] as const)
    .filter(([d]) => d.elementType === "definition") as [DefinitionDelta, number][];

  for (const [delta, idx] of defDeltas) {
    const isAccepted = accepted.has(idx);

    if (delta.kind === "unchanged") {
      merged.addDefinition(delta.existing!);
    } else if (delta.kind === "added") {
      if (isAccepted) merged.addDefinition(delta.incoming!);
    } else if (delta.kind === "removed") {
      if (!isAccepted) merged.addDefinition(delta.existing!);
    } else if (delta.kind === "modified") {
      merged.addDefinition(isAccepted ? delta.incoming! : delta.existing!);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Add a fact type to the merged model, remapping role player ids
 * from the source model (existing or incoming) to the merged model's ids.
 */
function addFactTypeToMerged(
  merged: OrmModel,
  source: import("../model/FactType.js").FactType,
  overrideId: string | null,
  incomingIdToMergedId: Map<string, string>,
): void {
  const roles: RoleConfig[] = source.roles.map((r) => ({
    name: r.name,
    id: r.id,
    playerId: resolvePlayerId(merged, r.playerId, incomingIdToMergedId, source),
  }));

  const config: FactTypeConfig = {
    name: source.name,
    id: overrideId ?? source.id,
    roles,
    readings: source.readings.map((r) => r.template),
    constraints: remapConstraintIds(source.constraints, source, merged, incomingIdToMergedId),
    definition: source.definition,
  };

  merged.addFactType(config);
}

/**
 * Resolve a player id to its merged-model equivalent.
 *
 * Tries (in order):
 * 1. The id already exists in the merged model -> use as-is (existing element).
 * 2. The id maps via incomingIdToMergedId -> use the mapped id.
 * 3. Try to find by name in the merged model (fallback for edge cases).
 */
function resolvePlayerId(
  merged: OrmModel,
  playerId: string,
  incomingIdToMergedId: Map<string, string>,
  _sourceFt: import("../model/FactType.js").FactType,
): string {
  // Direct hit in merged model.
  if (merged.getObjectType(playerId)) {
    return playerId;
  }

  // Mapped from incoming.
  const mapped = incomingIdToMergedId.get(playerId);
  if (mapped && merged.getObjectType(mapped)) {
    return mapped;
  }

  // This shouldn't normally happen, but return the original id to let
  // addFactType's validation surface a clear error.
  return playerId;
}

/**
 * Remap role ids inside constraints from the source model's id space
 * to the merged model's id space. Since role ids inside a fact type
 * don't change (we preserve them), this is mostly a pass-through.
 * However, for cross-fact-type constraints (external uniqueness, etc.),
 * ids may need remapping.
 */
function remapConstraintIds(
  constraints: readonly import("../model/Constraint.js").Constraint[],
  _source: import("../model/FactType.js").FactType,
  _merged: OrmModel,
  _idMap: Map<string, string>,
): import("../model/Constraint.js").Constraint[] {
  // For now, constraints within a single fact type use role ids
  // that are preserved verbatim (we keep the source's role ids).
  // Cross-fact-type constraints will need full id remapping when
  // the merge engine supports them.
  return [...constraints];
}
