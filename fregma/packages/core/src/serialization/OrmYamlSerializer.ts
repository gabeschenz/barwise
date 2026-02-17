import { stringify, parse } from "yaml";
import { OrmModel } from "../model/OrmModel.js";
import type { ObjectType } from "../model/ObjectType.js";
import type { FactType } from "../model/FactType.js";
import type { Role } from "../model/Role.js";
import type { Definition } from "../model/Definition.js";
import type {
  Constraint,
  InternalUniquenessConstraint,
  MandatoryRoleConstraint,
  ExternalUniquenessConstraint,
  ValueConstraint,
} from "../model/Constraint.js";
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
  | { type: "value_constraint"; role?: string; values: string[] };

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
    }
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
        return {
          type: "internal_uniqueness",
          roleIds: c.roles,
        } satisfies InternalUniquenessConstraint;
      case "mandatory":
        return {
          type: "mandatory",
          roleId: c.role,
        } satisfies MandatoryRoleConstraint;
      case "external_uniqueness":
        return {
          type: "external_uniqueness",
          roleIds: c.roles,
        } satisfies ExternalUniquenessConstraint;
      case "value_constraint":
        return {
          type: "value_constraint",
          roleId: c.role,
          values: c.values,
        } satisfies ValueConstraint;
    }
  }
}
