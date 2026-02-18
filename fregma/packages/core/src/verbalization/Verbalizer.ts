import type { OrmModel } from "../model/OrmModel.js";
import type { Verbalization } from "./Verbalization.js";
import { FactTypeVerbalizer } from "./FactTypeVerbalizer.js";
import { ConstraintVerbalizer } from "./ConstraintVerbalizer.js";

/**
 * Main entry point for verbalizing an ORM model.
 *
 * Produces structured Verbalization objects for fact types and their
 * constraints, suitable for rendering in documentation, UIs, or
 * review documents.
 */
export class Verbalizer {
  private readonly factTypeVerbalizer = new FactTypeVerbalizer();
  private readonly constraintVerbalizer = new ConstraintVerbalizer();

  /**
   * Verbalize the entire model: all fact type readings and all
   * constraints, returned as a flat list sorted by fact type order.
   */
  verbalizeModel(model: OrmModel): Verbalization[] {
    const results: Verbalization[] = [];

    for (const ft of model.factTypes) {
      // Fact type readings.
      results.push(...this.factTypeVerbalizer.verbalizeAll(ft, model));
      // Constraint verbalizations.
      results.push(
        ...this.constraintVerbalizer.verbalizeAll(ft, model),
      );
    }

    return results;
  }

  /**
   * Verbalize a single fact type: its primary reading and all
   * constraints.
   */
  verbalizeFactType(
    factTypeId: string,
    model: OrmModel,
  ): Verbalization[] {
    const ft = model.getFactType(factTypeId);
    if (!ft) {
      return [];
    }

    const results: Verbalization[] = [];
    results.push(...this.factTypeVerbalizer.verbalizeAll(ft, model));
    results.push(
      ...this.constraintVerbalizer.verbalizeAll(ft, model),
    );
    return results;
  }

  /** Access the underlying fact type verbalizer. */
  get factTypes(): FactTypeVerbalizer {
    return this.factTypeVerbalizer;
  }

  /** Access the underlying constraint verbalizer. */
  get constraints(): ConstraintVerbalizer {
    return this.constraintVerbalizer;
  }
}
