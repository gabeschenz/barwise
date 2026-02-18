import type { OrmModel } from "../model/OrmModel.js";
import type { FactType } from "../model/FactType.js";
import type { Constraint } from "../model/Constraint.js";
import {
  type Verbalization,
  type VerbalizationSegment,
  buildVerbalization,
  textSeg,
  refSeg,
  kwSeg,
  valSeg,
} from "./Verbalization.js";

/**
 * Verbalizes Phase 1 ORM constraints using FORML sentence patterns.
 *
 * FORML patterns (after Halpin):
 *   Internal uniqueness (single-role):
 *     "Each {Subject} {predicate} at most one {Object}."
 *   Internal uniqueness (multi-role):
 *     "For each {Role1} and {Role2} combination, {predicate} at most one {Object}."
 *   Mandatory role:
 *     "Each {Subject} {predicate} at least one {Object}."
 *   Value constraint:
 *     "The possible values of {TypeName} are: {'v1', 'v2', ...}."
 *   External uniqueness:
 *     "The combination of {roles...} is unique across fact types."
 */
export class ConstraintVerbalizer {
  /**
   * Verbalize all constraints on a fact type.
   */
  verbalizeAll(
    factType: FactType,
    model: OrmModel,
  ): Verbalization[] {
    return factType.constraints.map((c) =>
      this.verbalize(c, factType, model),
    );
  }

  /**
   * Verbalize a single constraint.
   */
  verbalize(
    constraint: Constraint,
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    switch (constraint.type) {
      case "internal_uniqueness":
        return this.verbalizeInternalUniqueness(
          constraint.roleIds,
          factType,
          model,
        );
      case "mandatory":
        return this.verbalizeMandatory(
          constraint.roleId,
          factType,
          model,
        );
      case "value_constraint":
        return this.verbalizeValueConstraint(
          constraint.roleId,
          constraint.values,
          factType,
          model,
        );
      case "external_uniqueness":
        return this.verbalizeExternalUniqueness(
          constraint.roleIds,
          factType,
          model,
        );
    }
  }

  /**
   * "Each {Subject} {predicate} at most one {Object}."
   * or for multi-role:
   * "For each {Role1} and {Role2} combination, {predicate} at most one {Object}."
   */
  private verbalizeInternalUniqueness(
    roleIds: readonly string[],
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    if (factType.arity === 2 && roleIds.length === 1) {
      return this.verbalizeBinaryUniqueness(
        roleIds[0]!,
        factType,
        model,
      );
    }

    if (factType.arity > 2 && roleIds.length < factType.arity) {
      return this.verbalizeMultiRoleUniqueness(
        roleIds,
        factType,
        model,
      );
    }

    // Fallback for unary or spanning uniqueness.
    return this.verbalizeGenericUniqueness(roleIds, factType, model);
  }

  /**
   * Binary fact type, single-role uniqueness.
   *
   * Given "Customer places Order" with uniqueness on the Order role:
   * => "Each Order is placed by at most one Customer."
   *
   * The constrained role is the subject; the other role is quantified.
   */
  private verbalizeBinaryUniqueness(
    constrainedRoleId: string,
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    const constrainedIdx = factType.roles.findIndex(
      (r) => r.id === constrainedRoleId,
    );
    const otherIdx = constrainedIdx === 0 ? 1 : 0;

    const subjectRole = factType.roles[constrainedIdx]!;
    const objectRole = factType.roles[otherIdx]!;
    const subjectType = model.getObjectType(subjectRole.playerId);
    const objectType = model.getObjectType(objectRole.playerId);
    const subjectName = subjectType?.name ?? subjectRole.name;
    const objectName = objectType?.name ?? objectRole.name;

    // Find a reading where the constrained role comes first.
    const predicate = extractPredicate(
      factType,
      constrainedIdx,
      otherIdx,
    );

    const segments: VerbalizationSegment[] = [
      kwSeg("Each "),
      refSeg(subjectName, subjectRole.playerId),
      textSeg(" " + predicate + " "),
      kwSeg("at most one "),
      refSeg(objectName, objectRole.playerId),
      textSeg("."),
    ];

    return buildVerbalization(factType.id, "constraint", segments);
  }

  /**
   * Multi-role uniqueness on a ternary+ fact type.
   *
   * "For each Employee and Project combination, at most one Department ..."
   */
  private verbalizeMultiRoleUniqueness(
    roleIds: readonly string[],
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    const constrainedIndices = roleIds
      .map((rid) => factType.roles.findIndex((r) => r.id === rid))
      .filter((i) => i >= 0);
    const unconstrainedIndices = factType.roles
      .map((_, i) => i)
      .filter((i) => !constrainedIndices.includes(i));

    const segments: VerbalizationSegment[] = [kwSeg("For each ")];

    // List constrained role players.
    for (let i = 0; i < constrainedIndices.length; i++) {
      const role = factType.roles[constrainedIndices[i]!]!;
      const ot = model.getObjectType(role.playerId);
      if (i > 0 && i === constrainedIndices.length - 1) {
        segments.push(textSeg(" and "));
      } else if (i > 0) {
        segments.push(textSeg(", "));
      }
      segments.push(refSeg(ot?.name ?? role.name, role.playerId));
    }

    segments.push(textSeg(" combination, "));
    segments.push(kwSeg("at most one "));

    // List unconstrained role players.
    for (let i = 0; i < unconstrainedIndices.length; i++) {
      const role = factType.roles[unconstrainedIndices[i]!]!;
      const ot = model.getObjectType(role.playerId);
      if (i > 0) {
        segments.push(textSeg(" and "));
      }
      segments.push(refSeg(ot?.name ?? role.name, role.playerId));
    }

    segments.push(textSeg(" applies."));

    return buildVerbalization(factType.id, "constraint", segments);
  }

  /**
   * Generic fallback for unary or spanning uniqueness.
   */
  private verbalizeGenericUniqueness(
    roleIds: readonly string[],
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    const roleNames = roleIds.map((rid) => {
      const role = factType.getRoleById(rid);
      if (!role) return rid;
      const ot = model.getObjectType(role.playerId);
      return ot?.name ?? role.name;
    });

    const segments: VerbalizationSegment[] = [
      textSeg("Each combination of "),
    ];

    for (let i = 0; i < roleIds.length; i++) {
      const role = factType.getRoleById(roleIds[i]!);
      if (i > 0 && i === roleIds.length - 1) {
        segments.push(textSeg(" and "));
      } else if (i > 0) {
        segments.push(textSeg(", "));
      }
      segments.push(
        refSeg(
          roleNames[i]!,
          role?.playerId ?? roleIds[i]!,
        ),
      );
    }

    segments.push(textSeg(" is unique in "));
    segments.push(textSeg(factType.name));
    segments.push(textSeg("."));

    return buildVerbalization(factType.id, "constraint", segments);
  }

  /**
   * "Each {Subject} {predicate} at least one {Object}."
   */
  private verbalizeMandatory(
    roleId: string,
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    if (factType.arity === 2) {
      return this.verbalizeBinaryMandatory(roleId, factType, model);
    }

    // Unary mandatory: "Each {Subject} {predicate}."
    const role = factType.getRoleById(roleId);
    const ot = role ? model.getObjectType(role.playerId) : undefined;
    const name = ot?.name ?? role?.name ?? roleId;
    const reading = factType.readings[0]?.template ?? "";
    const expanded = reading.replace(/\{\d+\}/g, name);

    return buildVerbalization(factType.id, "constraint", [
      kwSeg("Each "),
      refSeg(name, role?.playerId ?? roleId),
      textSeg(" must: "),
      textSeg(expanded),
      textSeg("."),
    ]);
  }

  private verbalizeBinaryMandatory(
    roleId: string,
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    const mandatoryIdx = factType.roles.findIndex(
      (r) => r.id === roleId,
    );
    const otherIdx = mandatoryIdx === 0 ? 1 : 0;

    const subjectRole = factType.roles[mandatoryIdx]!;
    const objectRole = factType.roles[otherIdx]!;
    const subjectType = model.getObjectType(subjectRole.playerId);
    const objectType = model.getObjectType(objectRole.playerId);
    const subjectName = subjectType?.name ?? subjectRole.name;
    const objectName = objectType?.name ?? objectRole.name;

    const predicate = extractPredicate(
      factType,
      mandatoryIdx,
      otherIdx,
    );

    const segments: VerbalizationSegment[] = [
      kwSeg("Each "),
      refSeg(subjectName, subjectRole.playerId),
      textSeg(" " + predicate + " "),
      kwSeg("at least one "),
      refSeg(objectName, objectRole.playerId),
      textSeg("."),
    ];

    return buildVerbalization(factType.id, "constraint", segments);
  }

  /**
   * "The possible values of {TypeName} are: {'v1', 'v2', ...}."
   */
  private verbalizeValueConstraint(
    roleId: string | undefined,
    values: readonly string[],
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    let targetName: string;
    let targetId: string;

    if (roleId) {
      const role = factType.getRoleById(roleId);
      const ot = role ? model.getObjectType(role.playerId) : undefined;
      targetName = ot?.name ?? role?.name ?? roleId;
      targetId = role?.playerId ?? roleId;
    } else {
      targetName = factType.name;
      targetId = factType.id;
    }

    const valueList = values.map((v) => `'${v}'`).join(", ");

    const segments: VerbalizationSegment[] = [
      textSeg("The possible values of "),
      refSeg(targetName, targetId),
      textSeg(" are: {"),
      valSeg(valueList),
      textSeg("}."),
    ];

    return buildVerbalization(factType.id, "constraint", segments);
  }

  /**
   * "The combination of {roles...} is unique across fact types."
   */
  private verbalizeExternalUniqueness(
    roleIds: readonly string[],
    factType: FactType,
    model: OrmModel,
  ): Verbalization {
    const segments: VerbalizationSegment[] = [
      textSeg("The combination of "),
    ];

    for (let i = 0; i < roleIds.length; i++) {
      const role = factType.getRoleById(roleIds[i]!);
      const ot = role ? model.getObjectType(role.playerId) : undefined;
      const name = ot?.name ?? role?.name ?? roleIds[i]!;

      if (i > 0 && i === roleIds.length - 1) {
        segments.push(textSeg(" and "));
      } else if (i > 0) {
        segments.push(textSeg(", "));
      }
      segments.push(refSeg(name, role?.playerId ?? roleIds[i]!));
    }

    segments.push(textSeg(" is unique across fact types."));

    return buildVerbalization(factType.id, "constraint", segments);
  }
}

/**
 * Extract the predicate text from a reading template for a binary
 * fact type, given a subject role index and an object role index.
 *
 * Looks for a reading where the subject placeholder comes first,
 * and extracts the text between the two placeholders.
 *
 * E.g., for "{0} places {1}" with subject=0, object=1 => "places"
 * E.g., for "{1} is placed by {0}" with subject=1, object=0 => "is placed by"
 */
function extractPredicate(
  factType: FactType,
  subjectIdx: number,
  objectIdx: number,
): string {
  const subjectPlaceholder = `{${subjectIdx}}`;
  const objectPlaceholder = `{${objectIdx}}`;

  // Prefer a reading where the subject comes first.
  for (const reading of factType.readings) {
    const t = reading.template;
    const subjectPos = t.indexOf(subjectPlaceholder);
    const objectPos = t.indexOf(objectPlaceholder);
    if (
      subjectPos >= 0 &&
      objectPos >= 0 &&
      subjectPos < objectPos
    ) {
      const start = subjectPos + subjectPlaceholder.length;
      return t.slice(start, objectPos).trim();
    }
  }

  // Fallback: use the first reading and extract between placeholders.
  const t = factType.readings[0]?.template ?? "";
  const p0 = t.indexOf("{");
  const p1 = t.indexOf("{", p0 + 1);
  if (p0 >= 0 && p1 >= 0) {
    const end0 = t.indexOf("}", p0) + 1;
    return t.slice(end0, p1).trim();
  }

  return "...";
}
