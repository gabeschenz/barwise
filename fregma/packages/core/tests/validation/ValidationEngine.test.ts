import { describe, it, expect } from "vitest";
import { ValidationEngine } from "../../src/validation/ValidationEngine.js";
import { OrmModel } from "../../src/model/OrmModel.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";
import type { Diagnostic } from "../../src/validation/Diagnostic.js";

describe("ValidationEngine", () => {
  it("returns no diagnostics for a well-formed model", () => {
    const engine = new ValidationEngine();
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", {
        referenceMode: "customer_id",
        definition: "A person who buys things.",
      })
      .withEntityType("Order", {
        referenceMode: "order_number",
        definition: "A confirmed purchase.",
      })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .build();

    const diagnostics = engine.validate(model);
    expect(diagnostics).toHaveLength(0);
  });

  it("returns no diagnostics for an empty model", () => {
    const engine = new ValidationEngine();
    const model = new OrmModel({ name: "Empty" });
    expect(engine.validate(model)).toHaveLength(0);
  });

  it("sorts diagnostics with errors first, then warnings, then info", () => {
    const engine = new ValidationEngine();

    // Build a model that triggers diagnostics at all severity levels:
    // - info: missing definition
    // - warning: no constraints on fact type, missing inverse reading
    const model = new OrmModel({ name: "Test" });
    const ot = model.addObjectType({
      name: "Thing",
      kind: "entity",
      referenceMode: "thing_id",
      // no definition -> info
    });
    const ot2 = model.addObjectType({
      name: "Other",
      kind: "entity",
      referenceMode: "other_id",
    });
    model.addFactType({
      name: "Thing has Other",
      roles: [
        { name: "has", playerId: ot.id },
        { name: "of", playerId: ot2.id },
      ],
      readings: ["{0} has {1}"], // missing inverse reading -> warning
      // no constraints -> warning
    });

    const diagnostics = engine.validate(model);
    expect(diagnostics.length).toBeGreaterThan(0);

    // Verify ordering: errors < warnings < info
    for (let i = 1; i < diagnostics.length; i++) {
      const prev = diagnostics[i - 1]!;
      const curr = diagnostics[i]!;
      const order = { error: 0, warning: 1, info: 2 };
      expect(order[prev.severity]).toBeLessThanOrEqual(
        order[curr.severity],
      );
    }
  });

  describe("isValid", () => {
    it("returns true for a model with no errors", () => {
      const engine = new ValidationEngine();
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", {
          referenceMode: "customer_id",
          definition: "A buyer.",
        })
        .withEntityType("Order", {
          referenceMode: "order_number",
          definition: "A purchase.",
        })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
        })
        .build();

      expect(engine.isValid(model)).toBe(true);
    });

    it("returns true even when warnings exist", () => {
      const engine = new ValidationEngine();
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({
        name: "Thing",
        kind: "entity",
        referenceMode: "thing_id",
        definition: "A thing.",
      });
      // Fact type with no constraints generates a warning.
      model.addFactType({
        name: "Thing exists",
        roles: [{ name: "exists", playerId: ot.id }],
        readings: ["{0} exists"],
      });

      const diagnostics = engine.validate(model);
      expect(diagnostics.some((d) => d.severity === "warning")).toBe(
        true,
      );
      expect(engine.isValid(model)).toBe(true);
    });

    it("returns false when errors exist", () => {
      const engine = new ValidationEngine();
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({
        name: "Widget",
        kind: "entity",
        referenceMode: "widget_id",
      });
      model.addFactType({
        name: "Widget has Color",
        roles: [
          { name: "has", playerId: ot.id, id: "r1" },
          { name: "of", playerId: ot.id, id: "r2" },
        ],
        readings: ["{0} has {1}", "{1} of {0}"],
        constraints: [
          { type: "internal_uniqueness", roleIds: ["r999"] },
        ],
      });

      expect(engine.isValid(model)).toBe(false);
    });
  });

  describe("errors", () => {
    it("returns only error-severity diagnostics", () => {
      const engine = new ValidationEngine();
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({
        name: "Widget",
        kind: "entity",
        referenceMode: "widget_id",
        // no definition -> info
      });
      model.addFactType({
        name: "Widget has Color",
        roles: [
          { name: "has", playerId: ot.id, id: "r1" },
          { name: "of", playerId: ot.id, id: "r2" },
        ],
        readings: ["{0} has {1}", "{1} of {0}"],
        constraints: [
          { type: "mandatory", roleId: "r-bad" }, // error
        ],
      });

      const errors = engine.errors(model);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every((d) => d.severity === "error")).toBe(true);
    });
  });

  describe("addRule", () => {
    it("includes diagnostics from custom rules", () => {
      const engine = new ValidationEngine();
      const customRule = (model: OrmModel): Diagnostic[] => {
        if (model.name === "Bad Name") {
          return [
            {
              severity: "error",
              message: "Model name is bad.",
              elementId: "model",
              ruleId: "custom/bad-name",
            },
          ];
        }
        return [];
      };

      engine.addRule(customRule);

      const good = new OrmModel({ name: "Good Name" });
      expect(engine.validate(good).length).toBe(0);

      const bad = new OrmModel({ name: "Bad Name" });
      const diagnostics = engine.validate(bad);
      expect(diagnostics.some((d) => d.ruleId === "custom/bad-name")).toBe(
        true,
      );
    });
  });
});
