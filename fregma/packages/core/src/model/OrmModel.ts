import { ObjectType, type ObjectTypeConfig } from "./ObjectType.js";
import { FactType, type FactTypeConfig } from "./FactType.js";
import type { Definition } from "./Definition.js";

/**
 * Configuration for creating a new OrmModel.
 */
export interface OrmModelConfig {
  readonly name: string;
  /** The bounded context this model represents. */
  readonly domainContext?: string;
}

/**
 * The root aggregate for an ORM model. Holds all object types, fact types,
 * and definitions, and provides query and mutation methods.
 *
 * The OrmModel enforces referential integrity: roles in fact types must
 * reference object types that exist in the model.
 */
export class OrmModel {
  private _name: string;
  private _domainContext: string | undefined;

  private readonly _objectTypes: Map<string, ObjectType> = new Map();
  private readonly _factTypes: Map<string, FactType> = new Map();
  private readonly _definitions: Definition[] = [];

  constructor(config: OrmModelConfig) {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error("Model name must be a non-empty string.");
    }
    this._name = config.name.trim();
    this._domainContext = config.domainContext;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("Model name must be a non-empty string.");
    }
    this._name = value.trim();
  }

  get domainContext(): string | undefined {
    return this._domainContext;
  }

  set domainContext(value: string | undefined) {
    this._domainContext = value;
  }

  // ---- Object Types ----

  /** All object types in the model. */
  get objectTypes(): readonly ObjectType[] {
    return [...this._objectTypes.values()];
  }

  /** Look up an object type by id. */
  getObjectType(id: string): ObjectType | undefined {
    return this._objectTypes.get(id);
  }

  /** Look up an object type by name. */
  getObjectTypeByName(name: string): ObjectType | undefined {
    return this.objectTypes.find((ot) => ot.name === name);
  }

  /**
   * Add an object type to the model.
   * @throws If an object type with the same name already exists.
   */
  addObjectType(config: ObjectTypeConfig): ObjectType {
    const existing = this.getObjectTypeByName(config.name);
    if (existing) {
      throw new Error(
        `Object type "${config.name}" already exists in model "${this._name}".`,
      );
    }
    const ot = new ObjectType(config);
    this._objectTypes.set(ot.id, ot);
    return ot;
  }

  /**
   * Remove an object type from the model.
   * @throws If any fact type references this object type.
   */
  removeObjectType(id: string): void {
    const ot = this._objectTypes.get(id);
    if (!ot) {
      throw new Error(`Object type with id "${id}" not found.`);
    }

    // Check for references from fact types.
    for (const ft of this._factTypes.values()) {
      for (const role of ft.roles) {
        if (role.playerId === id) {
          throw new Error(
            `Cannot remove object type "${ot.name}": it is referenced by ` +
              `role "${role.name}" in fact type "${ft.name}".`,
          );
        }
      }
    }

    this._objectTypes.delete(id);
  }

  // ---- Fact Types ----

  /** All fact types in the model. */
  get factTypes(): readonly FactType[] {
    return [...this._factTypes.values()];
  }

  /** Look up a fact type by id. */
  getFactType(id: string): FactType | undefined {
    return this._factTypes.get(id);
  }

  /** Look up a fact type by name. */
  getFactTypeByName(name: string): FactType | undefined {
    return this.factTypes.find((ft) => ft.name === name);
  }

  /**
   * Add a fact type to the model.
   * @throws If any role references a nonexistent object type.
   * @throws If a fact type with the same name already exists.
   */
  addFactType(config: FactTypeConfig): FactType {
    const existing = this.getFactTypeByName(config.name);
    if (existing) {
      throw new Error(
        `Fact type "${config.name}" already exists in model "${this._name}".`,
      );
    }

    // Validate that all role players exist.
    for (const roleConfig of config.roles) {
      if (!this._objectTypes.has(roleConfig.playerId)) {
        throw new Error(
          `Role "${roleConfig.name}" in fact type "${config.name}" ` +
            `references object type id "${roleConfig.playerId}" which ` +
            `does not exist in the model.`,
        );
      }
    }

    const ft = new FactType(config);
    this._factTypes.set(ft.id, ft);
    return ft;
  }

  /** Remove a fact type from the model. */
  removeFactType(id: string): void {
    if (!this._factTypes.has(id)) {
      throw new Error(`Fact type with id "${id}" not found.`);
    }
    this._factTypes.delete(id);
  }

  // ---- Definitions ----

  /** All ubiquitous language definitions. */
  get definitions(): readonly Definition[] {
    return [...this._definitions];
  }

  /** Add a ubiquitous language definition. */
  addDefinition(definition: Definition): void {
    if (!definition.term || definition.term.trim().length === 0) {
      throw new Error("Definition term must be a non-empty string.");
    }
    if (!definition.definition || definition.definition.trim().length === 0) {
      throw new Error("Definition text must be a non-empty string.");
    }
    this._definitions.push(definition);
  }

  // ---- Queries ----

  /** Get all fact types that a given object type participates in. */
  factTypesForObjectType(objectTypeId: string): readonly FactType[] {
    return this.factTypes.filter((ft) =>
      ft.roles.some((r) => r.playerId === objectTypeId),
    );
  }

  /** Count of all elements in the model. */
  get elementCount(): number {
    return (
      this._objectTypes.size +
      this._factTypes.size +
      this._definitions.length
    );
  }
}
