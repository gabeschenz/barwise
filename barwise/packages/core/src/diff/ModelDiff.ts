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

export type BreakingLevel = "safe" | "caution" | "breaking";

export interface ObjectTypeDelta {
  readonly kind: DeltaKind;
  readonly elementType: "object_type";
  readonly name: string;
  /** Present for modified, removed, unchanged. */
  readonly existing?: ObjectType;
  /** Present for added, modified, unchanged. */
  readonly incoming?: ObjectType;
  /** Human-readable descriptions of what changed (empty for add/remove). */
  readonly changeDescriptions: readonly string[];
  /** How risky this change is for downstream consumers. */
  readonly breakingLevel: BreakingLevel;
}

export interface FactTypeDelta {
  readonly kind: DeltaKind;
  readonly elementType: "fact_type";
  readonly name: string;
  readonly existing?: FactType;
  readonly incoming?: FactType;
  readonly changeDescriptions: readonly string[];
  /** How risky this change is for downstream consumers. */
  readonly breakingLevel: BreakingLevel;
}

export interface DefinitionDelta {
  readonly kind: DeltaKind;
  readonly elementType: "definition";
  readonly term: string;
  readonly existing?: Definition;
  readonly incoming?: Definition;
  readonly changeDescriptions: readonly string[];
  /** How risky this change is for downstream consumers. */
  readonly breakingLevel: BreakingLevel;
}

export type ModelDelta = ObjectTypeDelta | FactTypeDelta | DefinitionDelta;

/**
 * A pair of removed + added elements that may represent a rename
 * (i.e. the same concept under a different name). Flagged for human
 * resolution -- never auto-linked.
 */
export interface SynonymCandidate {
  /** The element type being compared. */
  readonly elementType: "object_type" | "fact_type";
  /** Name of the removed element. */
  readonly removedName: string;
  /** Name of the added element. */
  readonly addedName: string;
  /** Index of the removed delta in the deltas array. */
  readonly removedIndex: number;
  /** Index of the added delta in the deltas array. */
  readonly addedIndex: number;
  /** Why the pair was flagged (human-readable reasons). */
  readonly reasons: readonly string[];
}

export interface ModelDiffResult {
  readonly deltas: readonly ModelDelta[];
  readonly hasChanges: boolean;
  /** Potential synonym pairs detected from removed + added elements. */
  readonly synonymCandidates: readonly SynonymCandidate[];
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
        changeDescriptions: [],
        breakingLevel: classifyBreakingLevel("removed", []),
      });
    } else {
      const changes = diffObjectType(ot, match, existing, incoming);
      const kind: DeltaKind = changes.length > 0 ? "modified" : "unchanged";
      deltas.push({
        kind,
        elementType: "object_type",
        name,
        existing: ot,
        incoming: match,
        changeDescriptions: changes,
        breakingLevel: classifyBreakingLevel(kind, changes),
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
        changeDescriptions: [],
        breakingLevel: classifyBreakingLevel("added", []),
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
        changeDescriptions: [],
        breakingLevel: classifyBreakingLevel("removed", []),
      });
    } else {
      const changes = diffFactType(ft, match, existing, incoming);
      const kind: DeltaKind = changes.length > 0 ? "modified" : "unchanged";
      deltas.push({
        kind,
        elementType: "fact_type",
        name,
        existing: ft,
        incoming: match,
        changeDescriptions: changes,
        breakingLevel: classifyBreakingLevel(kind, changes),
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
        changeDescriptions: [],
        breakingLevel: classifyBreakingLevel("added", []),
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
        changeDescriptions: [],
        breakingLevel: classifyBreakingLevel("removed", []),
      });
    } else {
      const changes = diffDefinition(def, match);
      const kind: DeltaKind = changes.length > 0 ? "modified" : "unchanged";
      deltas.push({
        kind,
        elementType: "definition",
        term,
        existing: def,
        incoming: match,
        changeDescriptions: changes,
        breakingLevel: classifyBreakingLevel(kind, changes),
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
        changeDescriptions: [],
        breakingLevel: classifyBreakingLevel("added", []),
      });
    }
  }

  const hasChanges = deltas.some((d) => d.kind !== "unchanged");
  const synonymCandidates = detectSynonymCandidates(
    deltas,
    existing,
    incoming,
  );
  return { deltas, hasChanges, synonymCandidates };
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

// ---------------------------------------------------------------------------
// Breaking change classification
// ---------------------------------------------------------------------------

/**
 * Classify the breaking level of a change string from a modification delta.
 * Returns the severity level for a single change description.
 */
function classifyChange(change: string): BreakingLevel {
  // Safe: definition, aliases, source context, readings, role name changes.
  if (change === "definition changed") return "safe";
  if (change === "aliases changed") return "safe";
  if (change.startsWith("source context:")) return "safe";
  if (change === "readings changed") return "safe";
  if (/^role \d+: name /.test(change)) return "safe";

  // Breaking: kind change, arity change, role player change.
  if (change.startsWith("kind:")) return "breaking";
  if (change.startsWith("arity:")) return "breaking";
  if (/^role \d+: player /.test(change)) return "breaking";

  // Caution: data type, reference mode, value constraint, constraints.
  if (change.startsWith("data type:") || change.startsWith("data type added") || change.startsWith("data type removed")) return "caution";
  if (change.startsWith("reference mode:")) return "caution";
  if (change === "value constraint changed") return "caution";
  if (change.startsWith("constraints added")) return "caution";
  if (change.startsWith("constraints removed")) return "caution";

  // Unknown changes default to caution.
  return "caution";
}

/**
 * Compute the breaking level for a delta based on its kind and changes.
 * The most severe level among all changes wins.
 */
function classifyBreakingLevel(kind: DeltaKind, changes: readonly string[]): BreakingLevel {
  if (kind === "unchanged" || kind === "added") return "safe";
  if (kind === "removed") return "breaking";

  // Modified: classify each change and take the most severe.
  let level: BreakingLevel = "safe";
  for (const change of changes) {
    const changeLevel = classifyChange(change);
    if (changeLevel === "breaking") return "breaking";
    if (changeLevel === "caution") level = "caution";
  }
  return level;
}

// ---------------------------------------------------------------------------
// Synonym candidate detection
// ---------------------------------------------------------------------------

/**
 * Extract the reference mode suffix: the part after stripping the
 * type name prefix. For "customer_id" on type "Customer", the suffix
 * is "_id". Returns undefined if no reference mode is set.
 */
function refModeSuffix(
  refMode: string | undefined,
  typeName: string,
): string | undefined {
  if (!refMode) return undefined;
  const prefix = typeName.toLowerCase().replace(/\s+/g, "_");
  if (refMode.toLowerCase().startsWith(prefix)) {
    return refMode.slice(prefix.length);
  }
  // If the ref mode doesn't start with the type name, return the
  // whole thing -- it's still usable for comparison.
  return refMode;
}

/**
 * Compute the overlap ratio between two value constraint sets.
 * Returns 0 if either set is empty.
 */
function valueConstraintOverlap(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const intersect = a.filter((v) => setB.has(v)).length;
  const smaller = Math.min(a.length, b.length);
  return intersect / smaller;
}

/**
 * Scan for potential synonyms among removed + added pairs of the same
 * element type. Uses simple structural heuristics -- no fuzzy string
 * matching.
 */
function detectSynonymCandidates(
  deltas: readonly ModelDelta[],
  existingModel: OrmModel,
  incomingModel: OrmModel,
): SynonymCandidate[] {
  const candidates: SynonymCandidate[] = [];

  // --- Phase 1: Object type pairs ---
  const removedOts: { delta: ObjectTypeDelta; index: number }[] = [];
  const addedOts: { delta: ObjectTypeDelta; index: number }[] = [];
  const removedFts: { delta: FactTypeDelta; index: number }[] = [];
  const addedFts: { delta: FactTypeDelta; index: number }[] = [];

  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i]!;
    if (d.kind === "removed" && d.elementType === "object_type") {
      removedOts.push({ delta: d as ObjectTypeDelta, index: i });
    } else if (d.kind === "added" && d.elementType === "object_type") {
      addedOts.push({ delta: d as ObjectTypeDelta, index: i });
    } else if (d.kind === "removed" && d.elementType === "fact_type") {
      removedFts.push({ delta: d as FactTypeDelta, index: i });
    } else if (d.kind === "added" && d.elementType === "fact_type") {
      addedFts.push({ delta: d as FactTypeDelta, index: i });
    }
  }

  // Build a set of OT synonym name-pairs for fact type transitive matching.
  const otSynonymPairs = new Set<string>();

  for (const removed of removedOts) {
    const rOt = removed.delta.existing!;
    for (const added of addedOts) {
      const aOt = added.delta.incoming!;

      // Gate: same kind.
      if (rOt.kind !== aOt.kind) continue;

      const reasons: string[] = [];

      // Signal 1: Alias match.
      const rAliases = new Set(rOt.aliases ?? []);
      const aAliases = new Set(aOt.aliases ?? []);
      if (aAliases.has(rOt.name) || rAliases.has(aOt.name)) {
        reasons.push("alias match: names appear in each other's aliases");
      }

      // Signal 2: Matching reference mode suffix.
      const rSuffix = refModeSuffix(rOt.referenceMode, rOt.name);
      const aSuffix = refModeSuffix(aOt.referenceMode, aOt.name);
      if (rSuffix && aSuffix && rSuffix === aSuffix) {
        reasons.push(
          `matching reference mode suffix: "${rSuffix}"`,
        );
      }

      // Signal 3: Overlapping value constraints.
      const overlap = valueConstraintOverlap(
        rOt.valueConstraint?.values,
        aOt.valueConstraint?.values,
      );
      if (overlap >= 0.5) {
        reasons.push(
          `overlapping value constraint (${Math.round(overlap * 100)}% overlap)`,
        );
      }

      // At least one signal required.
      if (reasons.length === 0) continue;

      candidates.push({
        elementType: "object_type",
        removedName: rOt.name,
        addedName: aOt.name,
        removedIndex: removed.index,
        addedIndex: added.index,
        reasons,
      });

      otSynonymPairs.add(`${rOt.name}::${aOt.name}`);
    }
  }

  // --- Phase 2: Fact type pairs ---
  for (const removed of removedFts) {
    const rFt = removed.delta.existing!;
    for (const added of addedFts) {
      const aFt = added.delta.incoming!;

      // Gate: same arity.
      if (rFt.arity !== aFt.arity) continue;

      // Check role player correspondence at each position.
      let allCorrespond = true;
      const reasons: string[] = [];
      for (let i = 0; i < rFt.arity; i++) {
        const rPlayerName = playerName(existingModel, rFt.roles[i]!.playerId);
        const aPlayerName = playerName(incomingModel, aFt.roles[i]!.playerId);
        if (rPlayerName === aPlayerName) continue;
        // Check if they are an OT synonym pair.
        if (otSynonymPairs.has(`${rPlayerName}::${aPlayerName}`)) continue;
        allCorrespond = false;
        break;
      }

      if (!allCorrespond) continue;

      reasons.push("role players correspond (directly or via synonym candidates)");

      candidates.push({
        elementType: "fact_type",
        removedName: rFt.name,
        addedName: aFt.name,
        removedIndex: removed.index,
        addedIndex: added.index,
        reasons,
      });
    }
  }

  return candidates;
}
