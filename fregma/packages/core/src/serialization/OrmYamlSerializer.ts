import { stringify, parse } from "yaml";
import { OrmModel } from "../model/OrmModel.js";
import type { ObjectType, ConceptualDataTypeName } from "../model/ObjectType.js";
import type { FactType } from "../model/FactType.js";
import type { SubtypeFact } from "../model/SubtypeFact.js";
import type { ObjectifiedFactType } from "../model/ObjectifiedFactType.js";
import type { Population, FactInstance } from "../model/Population.js";
import type { Role } from "../model/Role.js";
import type { Definition } from "../model/Definition.js";
import type { Constraint, RingType } from "../model/Constraint.js";
import {
  SchemaValidator,
  type ValidationResult,
} from "./SchemaValidator.js";

/**
 * The shape of a parsed .orm.yaml document. This mirrors the JSON Schema
 * and is used as the intermediate representation between YAML text and
 * the in-memory OrmModel.
 */
interface OrmYamlDocument {
  orm_version: string;
  model: {
    name: string;
    domain_context?: string;
    object_types?: OrmYamlObjectType[];
    fact_types?: OrmYamlFactType[];
    subtype_facts?: OrmYamlSubtypeFact[];
    objectified_fact_types?: OrmYamlObjectifiedFactType[];
    populations?: OrmYamlPopulation[];
    definitions?: OrmYamlDefinition[];
  };
}

interface OrmYamlObjectType {
  id: string;
  name: string;
  kind: "entity" | "value";
  reference_mode?: string;
  definition?: string;
  source_context?: string;
  value_constraint?: { values: string[] };
  data_type?: { name: string; length?: number; scale?: number };
}

interface OrmYamlFactType {
  id: string;
  name: string;
  definition?: string;
  roles: OrmYamlRole[];
  readings: string[];
  constraints?: OrmYamlConstraint[];
}

interface OrmYamlRole {
  id: string;
  player: string;
  role_name: string;
}

type OrmYamlConstraint =
  | { type: "internal_uniqueness"; roles: string[] }
  | { type: "mandatory"; role: string }
  | { type: "external_uniqueness"; roles: string[] }
  | { type: "value_constraint"; role?: string; values: string[] }
  | { type: "disjunctive_mandatory"; roles: string[] }
  | { type: "exclusion"; roles: string[] }
  | { type: "exclusive_or"; roles: string[] }
  | { type: "subset"; subset_roles: string[]; superset_roles: string[] }
  | { type: "equality"; roles_1: string[]; roles_2: string[] }
  | { type: "ring"; role_1: string; role_2: string; ring_type: RingType }
  | { type: "frequency"; role: string; min: number; max: number | "unbounded" };

interface OrmYamlSubtypeFact {
  id: string;
  subtype: string;
  supertype: string;
  provides_identification?: boolean;
}

interface OrmYamlObjectifiedFactType {
  id: string;
  fact_type: string;
  object_type: string;
}

interface OrmYamlPopulation {
  id: string;
  fact_type: string;
  description?: string;
  instances: OrmYamlFactInstance[];
}

interface OrmYamlFactInstance {
  id: string;
  values: Record<string, string>;
}

interface OrmYamlDefinition {
  term: string;
  definition: string;
  context?: string;
}

/**
 * Error thrown when deserialization fails due to schema validation
 * or model construction errors.
 */
export class DeserializationError extends Error {
  constructor(
    message: string,
    readonly validationResult?: ValidationResult,
  ) {
    super(message);
    this.name = "DeserializationError";
  }
}

/**
 * Serializes OrmModel instances to YAML strings and deserializes
 * YAML strings back to OrmModel instances.
 *
 * The serializer produces YAML that conforms to the orm-model.schema.json
 * schema. The deserializer validates incoming YAML against the schema
 * before constructing the model.
 */
export class OrmYamlSerializer {
  private readonly validator = new SchemaValidator();

  /**
   * Serialize an OrmModel to a YAML string.
   *
   * The output includes the orm_version header and conforms to
   * the orm-model.schema.json schema.
   */
  serialize(model: OrmModel): string {
    const doc = this.toDocument(model);
    return stringify(doc, { lineWidth: 0 });
  }

  /**
   * Deserialize a YAML string into an OrmModel.
   *
   * The YAML is first validated against the JSON Schema. If validation
   * fails, a DeserializationError is thrown with the validation errors.
   *
   * The model is then constructed from the validated document. Construction
   * errors (e.g. referential integrity violations) are thrown as
   * DeserializationError.
   */
  deserialize(yaml: string): OrmModel {
    const raw = parse(yaml) as unknown;

    const result = this.validator.validateModel(raw);
    if (!result.valid) {
      throw new DeserializationError(
        `YAML does not conform to orm-model schema: ${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
        result,
      );
    }

    const doc = raw as OrmYamlDocument;
    return this.fromDocument(doc);
  }

  // -- Internal: model -> document --

  private toDocument(model: OrmModel): OrmYamlDocument {
    const doc: OrmYamlDocument = {
      orm_version: "1.0",
      model: {
        name: model.name,
      },
    };

    if (model.domainContext) {
      doc.model.domain_context = model.domainContext;
    }

    const objectTypes = model.objectTypes;
    if (objectTypes.length > 0) {
      doc.model.object_types = objectTypes.map((ot) =>
        this.serializeObjectType(ot),
      );
    }

    const factTypes = model.factTypes;
    if (factTypes.length > 0) {
      doc.model.fact_types = factTypes.map((ft) =>
        this.serializeFactType(ft),
      );
    }

    const subtypeFacts = model.subtypeFacts;
    if (subtypeFacts.length > 0) {
      doc.model.subtype_facts = subtypeFacts.map((sf) =>
        this.serializeSubtypeFact(sf),
      );
    }

    const objectifiedFactTypes = model.objectifiedFactTypes;
    if (objectifiedFactTypes.length > 0) {
      doc.model.objectified_fact_types = objectifiedFactTypes.map((oft) =>
        this.serializeObjectifiedFactType(oft),
      );
    }

    const populations = model.populations;
    if (populations.length > 0) {
      doc.model.populations = populations.map((p) =>
        this.serializePopulation(p),
      );
    }

    const definitions = model.definitions;
    if (definitions.length > 0) {
      doc.model.definitions = definitions.map((d) =>
        this.serializeDefinition(d),
      );
    }

    return doc;
  }

  private serializeObjectType(ot: ObjectType): OrmYamlObjectType {
    const result: OrmYamlObjectType = {
      id: ot.id,
      name: ot.name,
      kind: ot.kind,
    };

    if (ot.referenceMode) {
      result.reference_mode = ot.referenceMode;
    }
    if (ot.definition) {
      result.definition = ot.definition;
    }
    if (ot.sourceContext) {
      result.source_context = ot.sourceContext;
    }
    if (ot.valueConstraint) {
      result.value_constraint = { values: [...ot.valueConstraint.values] };
    }
    if (ot.dataType) {
      const dt: { name: string; length?: number; scale?: number } = { name: ot.dataType.name };
      if (ot.dataType.length !== undefined) dt.length = ot.dataType.length;
      if (ot.dataType.scale !== undefined) dt.scale = ot.dataType.scale;
      result.data_type = dt;
    }

    return result;
  }

  private serializeFactType(ft: FactType): OrmYamlFactType {
    const result: OrmYamlFactType = {
      id: ft.id,
      name: ft.name,
      roles: ft.roles.map((r) => this.serializeRole(r)),
      readings: ft.readings.map((ro) => ro.template),
    };

    if (ft.definition) {
      result.definition = ft.definition;
    }

    if (ft.constraints.length > 0) {
      result.constraints = ft.constraints.map((c) =>
        this.serializeConstraint(c),
      );
    }

    return result;
  }

  private serializeRole(role: Role): OrmYamlRole {
    return {
      id: role.id,
      player: role.playerId,
      role_name: role.name,
    };
  }

  private serializeConstraint(c: Constraint): OrmYamlConstraint {
    switch (c.type) {
      case "internal_uniqueness":
        return { type: "internal_uniqueness", roles: [...c.roleIds] };
      case "mandatory":
        return { type: "mandatory", role: c.roleId };
      case "external_uniqueness":
        return { type: "external_uniqueness", roles: [...c.roleIds] };
      case "value_constraint": {
        const result: OrmYamlConstraint = {
          type: "value_constraint",
          values: [...c.values],
        };
        if (c.roleId) {
          (result as { type: "value_constraint"; role?: string; values: string[] }).role = c.roleId;
        }
        return result;
      }
      case "disjunctive_mandatory":
        return { type: "disjunctive_mandatory", roles: [...c.roleIds] };
      case "exclusion":
        return { type: "exclusion", roles: [...c.roleIds] };
      case "exclusive_or":
        return { type: "exclusive_or", roles: [...c.roleIds] };
      case "subset":
        return { type: "subset", subset_roles: [...c.subsetRoleIds], superset_roles: [...c.supersetRoleIds] };
      case "equality":
        return { type: "equality", roles_1: [...c.roleIds1], roles_2: [...c.roleIds2] };
      case "ring":
        return { type: "ring", role_1: c.roleId1, role_2: c.roleId2, ring_type: c.ringType };
      case "frequency":
        return { type: "frequency", role: c.roleId, min: c.min, max: c.max };
    }
  }

  private serializeSubtypeFact(sf: SubtypeFact): OrmYamlSubtypeFact {
    const result: OrmYamlSubtypeFact = {
      id: sf.id,
      subtype: sf.subtypeId,
      supertype: sf.supertypeId,
    };
    if (!sf.providesIdentification) {
      result.provides_identification = false;
    }
    return result;
  }

  private serializeObjectifiedFactType(
    oft: ObjectifiedFactType,
  ): OrmYamlObjectifiedFactType {
    return {
      id: oft.id,
      fact_type: oft.factTypeId,
      object_type: oft.objectTypeId,
    };
  }

  private serializePopulation(pop: Population): OrmYamlPopulation {
    const result: OrmYamlPopulation = {
      id: pop.id,
      fact_type: pop.factTypeId,
      instances: pop.instances.map((inst) => this.serializeFactInstance(inst)),
    };
    if (pop.description) {
      result.description = pop.description;
    }
    return result;
  }

  private serializeFactInstance(inst: FactInstance): OrmYamlFactInstance {
    return {
      id: inst.id,
      values: { ...inst.values },
    };
  }

  private serializeDefinition(d: Definition): OrmYamlDefinition {
    const result: OrmYamlDefinition = {
      term: d.term,
      definition: d.definition,
    };
    if (d.context) {
      result.context = d.context;
    }
    return result;
  }

  // -- Internal: document -> model --

  private fromDocument(doc: OrmYamlDocument): OrmModel {
    const model = new OrmModel({
      name: doc.model.name,
      domainContext: doc.model.domain_context,
    });

    // Add object types first (fact types reference them).
    for (const otDoc of doc.model.object_types ?? []) {
      model.addObjectType({
        id: otDoc.id,
        name: otDoc.name,
        kind: otDoc.kind,
        referenceMode: otDoc.reference_mode,
        definition: otDoc.definition,
        sourceContext: otDoc.source_context,
        valueConstraint: otDoc.value_constraint
          ? { values: otDoc.value_constraint.values }
          : undefined,
        dataType: otDoc.data_type
          ? {
              name: otDoc.data_type.name as ConceptualDataTypeName,
              length: otDoc.data_type.length,
              scale: otDoc.data_type.scale,
            }
          : undefined,
      });
    }

    // Add fact types.
    for (const ftDoc of doc.model.fact_types ?? []) {
      const constraints = (ftDoc.constraints ?? []).map((c) =>
        this.deserializeConstraint(c),
      );

      model.addFactType({
        id: ftDoc.id,
        name: ftDoc.name,
        definition: ftDoc.definition,
        roles: ftDoc.roles.map((r) => ({
          id: r.id,
          name: r.role_name,
          playerId: r.player,
        })),
        readings: ftDoc.readings,
        constraints,
      });
    }

    // Add subtype facts (after object types and fact types).
    for (const sfDoc of doc.model.subtype_facts ?? []) {
      model.addSubtypeFact({
        id: sfDoc.id,
        subtypeId: sfDoc.subtype,
        supertypeId: sfDoc.supertype,
        providesIdentification: sfDoc.provides_identification ?? true,
      });
    }

    // Add objectified fact types (after object types and fact types).
    for (const oftDoc of doc.model.objectified_fact_types ?? []) {
      model.addObjectifiedFactType({
        id: oftDoc.id,
        factTypeId: oftDoc.fact_type,
        objectTypeId: oftDoc.object_type,
      });
    }

    // Add populations (after fact types, since they reference them).
    for (const popDoc of doc.model.populations ?? []) {
      const pop = model.addPopulation({
        id: popDoc.id,
        factTypeId: popDoc.fact_type,
        description: popDoc.description,
      });
      for (const instDoc of popDoc.instances) {
        pop.addInstance({
          id: instDoc.id,
          values: instDoc.values,
        });
      }
    }

    // Add definitions.
    for (const defDoc of doc.model.definitions ?? []) {
      model.addDefinition({
        term: defDoc.term,
        definition: defDoc.definition,
        context: defDoc.context,
      });
    }

    return model;
  }

  private deserializeConstraint(c: OrmYamlConstraint): Constraint {
    switch (c.type) {
      case "internal_uniqueness":
        return { type: "internal_uniqueness", roleIds: c.roles };
      case "mandatory":
        return { type: "mandatory", roleId: c.role };
      case "external_uniqueness":
        return { type: "external_uniqueness", roleIds: c.roles };
      case "value_constraint":
        return { type: "value_constraint", roleId: c.role, values: c.values };
      case "disjunctive_mandatory":
        return { type: "disjunctive_mandatory", roleIds: c.roles };
      case "exclusion":
        return { type: "exclusion", roleIds: c.roles };
      case "exclusive_or":
        return { type: "exclusive_or", roleIds: c.roles };
      case "subset":
        return { type: "subset", subsetRoleIds: c.subset_roles, supersetRoleIds: c.superset_roles };
      case "equality":
        return { type: "equality", roleIds1: c.roles_1, roleIds2: c.roles_2 };
      case "ring":
        return { type: "ring", roleId1: c.role_1, roleId2: c.role_2, ringType: c.ring_type };
      case "frequency":
        return { type: "frequency", roleId: c.role, min: c.min, max: c.max };
    }
  }
}
