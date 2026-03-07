import { ModelElement } from "./ModelElement.js";

/**
 * Configuration for creating a new Role.
 */
export interface RoleConfig {
  /** The role name used in verbalization (e.g. "places", "is placed by"). */
  readonly name: string;
  readonly id?: string;
  /** The id of the ObjectType that plays this role. */
  readonly playerId: string;
}

/**
 * A Role is a position within a FactType, played by an ObjectType.
 *
 * Roles are the fundamental connection between ObjectTypes and FactTypes.
 * Each role carries a name used in verbalization and a reference to the
 * ObjectType that plays it.
 */
export class Role extends ModelElement {
  readonly playerId: string;

  constructor(config: RoleConfig) {
    super(config.name, config.id);
    this.playerId = config.playerId;
  }
}
