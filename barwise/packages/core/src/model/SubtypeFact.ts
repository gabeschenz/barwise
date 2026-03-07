import { ModelElement } from "./ModelElement.js";

/**
 * Configuration for creating a new SubtypeFact.
 */
export interface SubtypeFactConfig {
  /** Optional stable identifier. Generated if omitted. */
  readonly id?: string;
  /** The id of the subtype (child) entity type. */
  readonly subtypeId: string;
  /** The id of the supertype (parent) entity type. */
  readonly supertypeId: string;
  /**
   * Whether the subtype uses the supertype's reference scheme for
   * identification (preferred identification path). When true, the
   * subtype does not need its own reference mode -- it inherits the
   * supertype's PK in relational mapping.
   */
  readonly providesIdentification?: boolean;
}

/**
 * A SubtypeFact represents a specialization relationship in ORM:
 * entity type A is a subtype of entity type B.
 *
 * Every instance of the subtype is also an instance of the supertype.
 * The subtype inherits all fact types and constraints of the supertype
 * and may have additional ones of its own.
 *
 * Example: "Employee is a subtype of Person" means every Employee is
 * a Person, but not every Person is necessarily an Employee.
 *
 * In relational mapping, subtype facts determine whether the subtype
 * is absorbed into the supertype's table or gets its own table with
 * a FK back to the supertype.
 */
export class SubtypeFact extends ModelElement {
  readonly subtypeId: string;
  readonly supertypeId: string;
  readonly providesIdentification: boolean;

  constructor(config: SubtypeFactConfig) {
    // Name is derived from the relationship for display purposes.
    // The actual subtype/supertype names are resolved by the model.
    super(
      `subtype:${config.subtypeId}:${config.supertypeId}`,
      config.id,
    );
    this.subtypeId = config.subtypeId;
    this.supertypeId = config.supertypeId;
    this.providesIdentification = config.providesIdentification ?? true;

    if (config.subtypeId === config.supertypeId) {
      throw new Error(
        "A subtype fact cannot have the same entity as both subtype and supertype.",
      );
    }
  }
}
