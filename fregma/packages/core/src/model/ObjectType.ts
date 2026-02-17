import { ModelElement } from "./ModelElement.js";

/**
 * Whether the object type is an entity (identified by a reference scheme)
 * or a value (self-identifying, e.g. a string or number).
 */
export type ObjectTypeKind = "entity" | "value";

/**
 * A value constraint restricts the allowed values for a value type or role.
 * Currently supports enumerated values. Range constraints can be added later.
 */
export interface ValueConstraintDef {
  readonly values: readonly string[];
}

/**
 * Configuration for creating a new ObjectType.
 */
export interface ObjectTypeConfig {
  readonly name: string;
  readonly id?: string;
  readonly kind: ObjectTypeKind;
  /** Required for entity types. The reference mode (e.g. "customer_id"). */
  readonly referenceMode?: string;
  /** Natural-language definition for the ubiquitous language. */
  readonly definition?: string;
  /** The bounded context this object type originates from. */
  readonly sourceContext?: string;
  /** Value constraint for value types. */
  readonly valueConstraint?: ValueConstraintDef;
}

/**
 * An ObjectType represents a concept in the domain.
 *
 * Entity types are identified by a reference scheme (e.g. Customer identified
 * by customer_id). Value types are self-identifying (e.g. a Name string or
 * a Rating enumeration).
 */
export class ObjectType extends ModelElement {
  readonly kind: ObjectTypeKind;
  private _referenceMode: string | undefined;
  private _definition: string | undefined;
  private _sourceContext: string | undefined;
  private _valueConstraint: ValueConstraintDef | undefined;

  constructor(config: ObjectTypeConfig) {
    super(config.name, config.id);
    this.kind = config.kind;
    this._referenceMode = config.referenceMode;
    this._definition = config.definition;
    this._sourceContext = config.sourceContext;
    this._valueConstraint = config.valueConstraint;

    if (this.kind === "entity" && !this._referenceMode) {
      throw new Error(
        `Entity type "${this.name}" must have a reference mode.`,
      );
    }

    if (this.kind === "value" && this._referenceMode) {
      throw new Error(
        `Value type "${this.name}" should not have a reference mode.`,
      );
    }

    if (
      this._valueConstraint &&
      this._valueConstraint.values.length === 0
    ) {
      throw new Error(
        `Value constraint on "${this.name}" must have at least one value.`,
      );
    }
  }

  get referenceMode(): string | undefined {
    return this._referenceMode;
  }

  get definition(): string | undefined {
    return this._definition;
  }

  set definition(value: string | undefined) {
    this._definition = value;
  }

  get sourceContext(): string | undefined {
    return this._sourceContext;
  }

  set sourceContext(value: string | undefined) {
    this._sourceContext = value;
  }

  get valueConstraint(): ValueConstraintDef | undefined {
    return this._valueConstraint;
  }

  get isEntity(): boolean {
    return this.kind === "entity";
  }

  get isValue(): boolean {
    return this.kind === "value";
  }
}
