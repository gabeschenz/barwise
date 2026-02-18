import type { OrmModel } from "./OrmModel.js";

/**
 * Configuration for creating a DomainModel reference.
 */
export interface DomainModelConfig {
  /** File path relative to the project root. */
  readonly path: string;
  /** The bounded context name (unique within the project). */
  readonly context: string;
}

/**
 * A DomainModel is a reference to a single bounded context's ORM model
 * within a multi-domain project.
 *
 * The DomainModel carries the file path and context name, and holds
 * the loaded OrmModel once resolved.
 */
export class DomainModel {
  readonly path: string;
  readonly context: string;
  private _model: OrmModel | undefined;

  constructor(config: DomainModelConfig) {
    if (!config.path || config.path.trim().length === 0) {
      throw new Error("Domain model path must be a non-empty string.");
    }
    if (!config.context || config.context.trim().length === 0) {
      throw new Error("Domain model context must be a non-empty string.");
    }
    this.path = config.path.trim();
    this.context = config.context.trim();
  }

  /** The loaded ORM model, or undefined if not yet resolved. */
  get model(): OrmModel | undefined {
    return this._model;
  }

  /** Attach a loaded ORM model to this domain reference. */
  setModel(model: OrmModel): void {
    this._model = model;
  }
}
