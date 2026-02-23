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
 * - Subtype facts reference existing entity types.
 * - Subtype hierarchy has no cycles.
 */
export function structuralRules(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...checkDanglingRoleReferences(model));
  diagnostics.push(...checkDuplicateObjectTypeNames(model));
  diagnostics.push(...checkDuplicateFactTypeNames(model));
  diagnostics.push(...checkBinaryFactTypeReadings(model));
  diagnostics.push(...checkSubtypeFactReferences(model));
  diagnostics.push(...checkSubtypeCycles(model));

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

/**
 * Subtype facts must reference existing entity types for both the
 * subtype and supertype sides.
 */
function checkSubtypeFactReferences(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const sf of model.subtypeFacts) {
    const subtype = model.getObjectType(sf.subtypeId);
    if (!subtype) {
      diagnostics.push({
        severity: "error",
        message:
          `Subtype fact references subtype id "${sf.subtypeId}" ` +
          `which does not exist in the model.`,
        elementId: sf.id,
        ruleId: "structural/subtype-dangling-subtype",
      });
    } else if (subtype.kind !== "entity") {
      diagnostics.push({
        severity: "error",
        message:
          `Subtype fact references "${subtype.name}" as subtype, ` +
          `but it is a ${subtype.kind} type. Only entity types can participate in subtype relationships.`,
        elementId: sf.id,
        ruleId: "structural/subtype-not-entity",
      });
    }

    const supertype = model.getObjectType(sf.supertypeId);
    if (!supertype) {
      diagnostics.push({
        severity: "error",
        message:
          `Subtype fact references supertype id "${sf.supertypeId}" ` +
          `which does not exist in the model.`,
        elementId: sf.id,
        ruleId: "structural/subtype-dangling-supertype",
      });
    } else if (supertype.kind !== "entity") {
      diagnostics.push({
        severity: "error",
        message:
          `Subtype fact references "${supertype.name}" as supertype, ` +
          `but it is a ${supertype.kind} type. Only entity types can participate in subtype relationships.`,
        elementId: sf.id,
        ruleId: "structural/subtype-not-entity",
      });
    }
  }

  return diagnostics;
}

/**
 * The subtype hierarchy must not contain cycles.
 * A cycle means A is a subtype of B, B is a subtype of C, and C is a
 * subtype of A -- which is logically impossible.
 */
function checkSubtypeCycles(model: OrmModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Build adjacency list: subtypeId -> supertypeIds.
  const edges = new Map<string, string[]>();
  for (const sf of model.subtypeFacts) {
    const existing = edges.get(sf.subtypeId);
    if (existing) {
      existing.push(sf.supertypeId);
    } else {
      edges.set(sf.subtypeId, [sf.supertypeId]);
    }
  }

  // DFS cycle detection.
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true; // cycle
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    for (const supertypeId of edges.get(nodeId) ?? []) {
      if (dfs(supertypeId)) return true;
    }

    inStack.delete(nodeId);
    return false;
  }

  for (const nodeId of edges.keys()) {
    if (!visited.has(nodeId) && dfs(nodeId)) {
      diagnostics.push({
        severity: "error",
        message: "The subtype hierarchy contains a cycle.",
        elementId: nodeId,
        ruleId: "structural/subtype-cycle",
      });
      break; // Report once, not per node.
    }
  }

  return diagnostics;
}
