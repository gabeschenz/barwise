/**
 * Model-level diff engine.
 *
 * Compares two OrmModels element-by-element, matching by name (since
 * LLM re-extractions produce fresh UUIDs). Produces a flat list of
 * ModelDelta items that each describe a single element-level change:
 * added, removed, modified, or unchanged.
 *
 * The diff covers object types, fact types, and definitions.
 */

import type { OrmModel } from "../model/OrmModel.js";
import type { ObjectType, DataTypeDef } from "../model/ObjectType.js";
import type { FactType } from "../model/FactType.js";
import type { Constraint } from "../model/Constraint.js";
import type { Role } from "../model/Role.js";
import type { Definition } from "../model/Definition.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DeltaKind = "added" | "removed" | "modified" | "unchanged";

export interface ObjectTypeDelta {
  readonly kind: DeltaKind;
  readonly elementType: "object_type";
  readonly name: string;
  /** Present for modified, removed, unchanged. */
  readonly existing?: ObjectType;
  /** Present for added, modified, unchanged. */
  readonly incoming?: ObjectType;
  /** Human-readable summary of what changed (empty for add/remove). */
  readonly changes: readonly string[];
}

export interface FactTypeDelta {
  readonly kind: DeltaKind;
  readonly elementType: "fact_type";
  readonly name: string;
  readonly existing?: FactType;
  readonly incoming?: FactType;
  readonly changes: readonly string[];
}

export interface DefinitionDelta {
  readonly kind: DeltaKind;
  readonly elementType: "definition";
  readonly term: string;
  readonly existing?: Definition;
  readonly incoming?: Definition;
  readonly changes: readonly string[];
}

export type ModelDelta = ObjectTypeDelta | FactTypeDelta | DefinitionDelta;

export interface ModelDiffResult {
  readonly deltas: readonly ModelDelta[];
  readonly hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Diff two ORM models, matching elements by name.
 *
 * @param existing The model already on disk (reviewed/approved).
 * @param incoming The freshly extracted model from the LLM.
 * @returns A list of deltas covering every element in either model.
 */
export function diffModels(
  existing: OrmModel,
  incoming: OrmModel,
): ModelDiffResult {
  const deltas: ModelDelta[] = [];

  // --- Object types ---
  const existingOts = new Map(existing.objectTypes.map((ot) => [ot.name, ot]));
  const incomingOts = new Map(incoming.objectTypes.map((ot) => [ot.name, ot]));

  for (const [name, ot] of existingOts) {
    const match = incomingOts.get(name);
    if (!match) {
      deltas.push({
        kind: "removed",
        elementType: "object_type",
        name,
        existing: ot,
        changes: [],
      });
    } else {
      const changes = diffObjectType(ot, match, existing, incoming);
      deltas.push({
        kind: changes.length > 0 ? "modified" : "unchanged",
        elementType: "object_type",
        name,
        existing: ot,
        incoming: match,
        changes,
      });
    }
  }

  for (const [name, ot] of incomingOts) {
    if (!existingOts.has(name)) {
      deltas.push({
        kind: "added",
        elementType: "object_type",
        name,
        incoming: ot,
        changes: [],
      });
    }
  }

  // --- Fact types ---
  const existingFts = new Map(existing.factTypes.map((ft) => [ft.name, ft]));
  const incomingFts = new Map(incoming.factTypes.map((ft) => [ft.name, ft]));

  for (const [name, ft] of existingFts) {
    const match = incomingFts.get(name);
    if (!match) {
      deltas.push({
        kind: "removed",
        elementType: "fact_type",
        name,
        existing: ft,
        changes: [],
      });
    } else {
      const changes = diffFactType(ft, match, existing, incoming);
      deltas.push({
        kind: changes.length > 0 ? "modified" : "unchanged",
        elementType: "fact_type",
        name,
        existing: ft,
        incoming: match,
        changes,
      });
    }
  }

  for (const [name, ft] of incomingFts) {
    if (!existingFts.has(name)) {
      deltas.push({
        kind: "added",
        elementType: "fact_type",
        name,
        incoming: ft,
        changes: [],
      });
    }
  }

  // --- Definitions ---
  const existingDefs = new Map(
    existing.definitions.map((d) => [d.term, d]),
  );
  const incomingDefs = new Map(
    incoming.definitions.map((d) => [d.term, d]),
  );

  for (const [term, def] of existingDefs) {
    const match = incomingDefs.get(term);
    if (!match) {
      deltas.push({
        kind: "removed",
        elementType: "definition",
        term,
        existing: def,
        changes: [],
      });
    } else {
      const changes = diffDefinition(def, match);
      deltas.push({
        kind: changes.length > 0 ? "modified" : "unchanged",
        elementType: "definition",
        term,
        existing: def,
        incoming: match,
        changes,
      });
    }
  }

  for (const [term, def] of incomingDefs) {
    if (!existingDefs.has(term)) {
      deltas.push({
        kind: "added",
        elementType: "definition",
        term,
        incoming: def,
        changes: [],
      });
    }
  }

  const hasChanges = deltas.some((d) => d.kind !== "unchanged");
  return { deltas, hasChanges };
}

// ---------------------------------------------------------------------------
// Element-level comparison helpers
// ---------------------------------------------------------------------------

function diffObjectType(
  a: ObjectType,
  b: ObjectType,
  _existingModel: OrmModel,
  _incomingModel: OrmModel,
): string[] {
  const changes: string[] = [];

  if (a.kind !== b.kind) {
    changes.push(`kind: ${a.kind} -> ${b.kind}`);
  }
  if ((a.referenceMode ?? "") !== (b.referenceMode ?? "")) {
    changes.push(
      `reference mode: "${a.referenceMode ?? "(none)"}" -> "${b.referenceMode ?? "(none)"}"`,
    );
  }
  if ((a.definition ?? "") !== (b.definition ?? "")) {
    changes.push("definition changed");
  }
  if ((a.sourceContext ?? "") !== (b.sourceContext ?? "")) {
    changes.push(
      `source context: "${a.sourceContext ?? "(none)"}" -> "${b.sourceContext ?? "(none)"}"`,
    );
  }

  const aVals = a.valueConstraint?.values.slice().sort().join(",") ?? "";
  const bVals = b.valueConstraint?.values.slice().sort().join(",") ?? "";
  if (aVals !== bVals) {
    changes.push("value constraint changed");
  }

  // Aliases comparison (order-insensitive).
  const aAliases = (a.aliases ?? []).slice().sort().join(",");
  const bAliases = (b.aliases ?? []).slice().sort().join(",");
  if (aAliases !== bAliases) {
    changes.push("aliases changed");
  }

  // Data type comparison.
  const aDt = a.dataType;
  const bDt = b.dataType;
  if (aDt && bDt) {
    if (aDt.name !== bDt.name || aDt.length !== bDt.length || aDt.scale !== bDt.scale) {
      changes.push(`data type: ${formatDataType(aDt)} -> ${formatDataType(bDt)}`);
    }
  } else if (aDt && !bDt) {
    changes.push(`data type removed (was ${formatDataType(aDt)})`);
  } else if (!aDt && bDt) {
    changes.push(`data type added: ${formatDataType(bDt)}`);
  }

  return changes;
}

/**
 * Resolve an object type id to its name using the given model.
 * Returns the id itself if the object type is not found.
 */
function playerName(model: OrmModel, playerId: string): string {
  return model.getObjectType(playerId)?.name ?? playerId;
}

function diffFactType(
  a: FactType,
  b: FactType,
  existingModel: OrmModel,
  incomingModel: OrmModel,
): string[] {
  const changes: string[] = [];

  // Compare roles by position: player name and role name.
  if (a.arity !== b.arity) {
    changes.push(`arity: ${a.arity} -> ${b.arity}`);
  } else {
    for (let i = 0; i < a.arity; i++) {
      const ra = a.roles[i]!;
      const rb = b.roles[i]!;
      const nameA = playerName(existingModel, ra.playerId);
      const nameB = playerName(incomingModel, rb.playerId);
      if (nameA !== nameB) {
        changes.push(`role ${i}: player ${nameA} -> ${nameB}`);
      }
      if (ra.name !== rb.name) {
        changes.push(`role ${i}: name "${ra.name}" -> "${rb.name}"`);
      }
    }
  }

  // Readings.
  const readingsA = a.readings.map((r) => r.template).join(" | ");
  const readingsB = b.readings.map((r) => r.template).join(" | ");
  if (readingsA !== readingsB) {
    changes.push("readings changed");
  }

  // Constraints -- pass both role arrays so constraintKey can resolve
  // role IDs to positional indices (stable across LLM re-extractions).
  const constraintDiff = diffConstraints(
    a.constraints,
    b.constraints,
    a.roles,
    b.roles,
  );
  changes.push(...constraintDiff);

  if ((a.definition ?? "") !== (b.definition ?? "")) {
    changes.push("definition changed");
  }

  return changes;
}

/**
 * Build a role-id-to-index lookup from a roles array.
 */
function roleIndexMap(roles: readonly Role[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < roles.length; i++) {
    m.set(roles[i]!.id, i);
  }
  return m;
}

/**
 * Resolve a role ID to its positional index using the lookup.
 * Falls back to the raw ID for cross-fact-type constraints whose role
 * IDs don't belong to this fact type.
 */
function resolveRole(id: string, idxMap: Map<string, number>): string {
  const idx = idxMap.get(id);
  return idx !== undefined ? String(idx) : id;
}

/**
 * Produce a stable, comparable string key for a constraint, normalized
 * so that role IDs are replaced with positional indices within the
 * parent fact type. This eliminates false-positive diffs caused by
 * fresh UUIDs from LLM re-extractions.
 */
function constraintKey(
  c: Constraint,
  idxMap: Map<string, number>,
): string {
  switch (c.type) {
    case "internal_uniqueness": {
      const indices = c.roleIds.map((id) => resolveRole(id, idxMap)).sort();
      return `IU:${indices.join(",")}:${c.isPreferred ? "P" : ""}`;
    }
    case "mandatory":
      return `M:${resolveRole(c.roleId, idxMap)}`;
    case "external_uniqueness": {
      const indices = c.roleIds.map((id) => resolveRole(id, idxMap)).sort();
      return `EU:${indices.join(",")}`;
    }
    case "value_constraint": {
      const role = c.roleId ? resolveRole(c.roleId, idxMap) : "";
      const vals = [...c.values].sort().join(",");
      return `VC:${role}:${vals}`;
    }
    case "disjunctive_mandatory": {
      const indices = c.roleIds.map((id) => resolveRole(id, idxMap)).sort();
      return `DM:${indices.join(",")}`;
    }
    case "exclusion": {
      const indices = c.roleIds.map((id) => resolveRole(id, idxMap)).sort();
      return `EX:${indices.join(",")}`;
    }
    case "exclusive_or": {
      const indices = c.roleIds.map((id) => resolveRole(id, idxMap)).sort();
      return `XO:${indices.join(",")}`;
    }
    case "subset": {
      const sub = c.subsetRoleIds.map((id) => resolveRole(id, idxMap));
      const sup = c.supersetRoleIds.map((id) => resolveRole(id, idxMap));
      return `SUB:${sub.join(",")}:${sup.join(",")}`;
    }
    case "equality": {
      const ids1 = c.roleIds1.map((id) => resolveRole(id, idxMap));
      const ids2 = c.roleIds2.map((id) => resolveRole(id, idxMap));
      return `EQ:${ids1.join(",")}:${ids2.join(",")}`;
    }
    case "ring":
      return `RING:${resolveRole(c.roleId1, idxMap)},${resolveRole(c.roleId2, idxMap)}:${c.ringType}`;
    case "frequency":
      return `FREQ:${resolveRole(c.roleId, idxMap)}:${c.min}:${c.max}`;
  }
}

function diffConstraints(
  a: readonly Constraint[],
  b: readonly Constraint[],
  rolesA: readonly Role[],
  rolesB: readonly Role[],
): string[] {
  const changes: string[] = [];

  const idxMapA = roleIndexMap(rolesA);
  const idxMapB = roleIndexMap(rolesB);

  const keysA = new Set(a.map((c) => constraintKey(c, idxMapA)));
  const keysB = new Set(b.map((c) => constraintKey(c, idxMapB)));

  const added = b.filter((c) => !keysA.has(constraintKey(c, idxMapB)));
  const removed = a.filter((c) => !keysB.has(constraintKey(c, idxMapA)));

  if (added.length > 0) {
    const types = [...new Set(added.map((c) => c.type))].join(", ");
    changes.push(`constraints added: ${types}`);
  }
  if (removed.length > 0) {
    const types = [...new Set(removed.map((c) => c.type))].join(", ");
    changes.push(`constraints removed: ${types}`);
  }

  return changes;
}

/** Format a DataTypeDef for human-readable diff output. */
function formatDataType(dt: DataTypeDef): string {
  let s = dt.name;
  if (dt.length !== undefined) s += `(${dt.length}`;
  if (dt.length !== undefined && dt.scale !== undefined) s += `,${dt.scale}`;
  if (dt.length !== undefined) s += ")";
  return s;
}

function diffDefinition(a: Definition, b: Definition): string[] {
  const changes: string[] = [];
  if (a.definition !== b.definition) {
    changes.push("definition text changed");
  }
  if ((a.context ?? "") !== (b.context ?? "")) {
    changes.push(
      `context: "${a.context ?? "(none)"}" -> "${b.context ?? "(none)"}"`,
    );
  }
  return changes;
}
