/**
 * Tests for population validation rules.
 *
 * Covers:
 *   - Dangling fact type references
 *   - Internal uniqueness constraint violations
 *   - Value constraint violations
 *   - Frequency constraint violations
 *   - Valid populations produce no diagnostics
 */
import { describe, it, expect } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";
import { populationValidationRules } from "../../src/validation/rules/populationValidation.js";

/**
 * Build a model with "Customer places Order" fact type and configurable
 * constraints for testing.
 */
function makeOrderModel(options?: {
  uniqueness?: "role1" | "role2" | "spanning";
  valueConstraint?: { roleId: string; values: string[] };
  frequency?: { roleId: string; min: number; max: number | "unbounded" };
}): OrmModel {
  const model = new OrmModel({ name: "Test" });
  const customer = model.addObjectType({
    name: "Customer",
    kind: "entity",
    referenceMode: "customer_id",
  });
  const order = model.addObjectType({
    name: "Order",
    kind: "entity",
    referenceMode: "order_number",
  });

  const constraints: Parameters<typeof model.addFactType>[0]["constraints"] =
    [];

  if (options?.uniqueness === "role1") {
    constraints.push({ type: "internal_uniqueness", roleIds: ["r1"] });
  } else if (options?.uniqueness === "role2") {
    constraints.push({ type: "internal_uniqueness", roleIds: ["r2"] });
  } else if (options?.uniqueness === "spanning") {
    constraints.push({
      type: "internal_uniqueness",
      roleIds: ["r1", "r2"],
    });
  }

  if (options?.valueConstraint) {
    constraints.push({
      type: "value_constraint",
      roleId: options.valueConstraint.roleId,
      values: options.valueConstraint.values,
    });
  }

  if (options?.frequency) {
    constraints.push({
      type: "frequency",
      roleId: options.frequency.roleId,
      min: options.frequency.min,
      max: options.frequency.max,
    });
  }

  model.addFactType({
    name: "Customer places Order",
    roles: [
      { name: "places", playerId: customer.id, id: "r1" },
      { name: "is placed by", playerId: order.id, id: "r2" },
    ],
    readings: ["{0} places {1}"],
    constraints,
  });

  return model;
}

describe("populationValidationRules", () => {
  describe("valid populations", () => {
    it("produces no diagnostics for a valid population", () => {
      const model = makeOrderModel({ uniqueness: "role2" });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C001", r2: "O123" } });
      pop.addInstance({ values: { r1: "C001", r2: "O124" } });
      pop.addInstance({ values: { r1: "C002", r2: "O125" } });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });

    it("produces no diagnostics when no populations exist", () => {
      const model = makeOrderModel();
      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });

    it("produces no diagnostics for empty population", () => {
      const model = makeOrderModel({ uniqueness: "role2" });
      const ft = model.getFactTypeByName("Customer places Order")!;
      model.addPopulation({ factTypeId: ft.id });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });
  });

  describe("dangling fact type reference", () => {
    it("reports error for population referencing nonexistent fact type", () => {
      const model = makeOrderModel();
      const ft = model.getFactTypeByName("Customer places Order")!;
      // Add a valid population first, then remove the fact type.
      // Since OrmModel.addPopulation validates, we need to add before removing.
      const pop = model.addPopulation({ factTypeId: ft.id });
      model.removeFactType(ft.id);

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("population/dangling-fact-type");
      expect(diags[0]!.elementId).toBe(pop.id);
    });
  });

  describe("uniqueness violations", () => {
    it("reports single-role uniqueness violation", () => {
      const model = makeOrderModel({ uniqueness: "role2" });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({
        id: "inst-1",
        values: { r1: "C001", r2: "O123" },
      });
      pop.addInstance({
        id: "inst-2",
        values: { r1: "C002", r2: "O123" },
      }); // Duplicate on r2

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("population/uniqueness-violation");
      expect(diags[0]!.message).toContain("inst-2");
      expect(diags[0]!.message).toContain("inst-1");
    });

    it("reports spanning uniqueness violation", () => {
      const model = makeOrderModel({ uniqueness: "spanning" });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({
        id: "inst-1",
        values: { r1: "C001", r2: "O123" },
      });
      pop.addInstance({
        id: "inst-2",
        values: { r1: "C001", r2: "O123" },
      }); // Exact duplicate

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("population/uniqueness-violation");
    });

    it("does not report spanning uniqueness for distinct combinations", () => {
      const model = makeOrderModel({ uniqueness: "spanning" });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C001", r2: "O123" } });
      pop.addInstance({ values: { r1: "C001", r2: "O124" } });
      pop.addInstance({ values: { r1: "C002", r2: "O123" } });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });

    it("reports multiple uniqueness violations", () => {
      const model = makeOrderModel({ uniqueness: "role1" });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ id: "inst-1", values: { r1: "C001", r2: "O123" } });
      pop.addInstance({ id: "inst-2", values: { r1: "C001", r2: "O124" } });
      pop.addInstance({ id: "inst-3", values: { r1: "C001", r2: "O125" } });

      const diags = populationValidationRules(model);
      // inst-2 and inst-3 both duplicate inst-1's r1 value
      expect(diags).toHaveLength(2);
      expect(diags.every((d) => d.ruleId === "population/uniqueness-violation")).toBe(true);
    });
  });

  describe("value constraint violations", () => {
    it("reports value not in allowed set", () => {
      const model = makeOrderModel({
        valueConstraint: { roleId: "r1", values: ["C001", "C002", "C003"] },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({
        id: "inst-1",
        values: { r1: "C999", r2: "O123" },
      });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("population/value-constraint-violation");
      expect(diags[0]!.message).toContain("C999");
      expect(diags[0]!.message).toContain("C001");
    });

    it("passes when value is in allowed set", () => {
      const model = makeOrderModel({
        valueConstraint: { roleId: "r1", values: ["C001", "C002"] },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C001", r2: "O123" } });
      pop.addInstance({ values: { r1: "C002", r2: "O124" } });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });

    it("reports multiple value violations", () => {
      const model = makeOrderModel({
        valueConstraint: { roleId: "r1", values: ["C001"] },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C002", r2: "O123" } });
      pop.addInstance({ values: { r1: "C003", r2: "O124" } });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(2);
    });
  });

  describe("frequency violations", () => {
    it("reports when value appears fewer times than minimum", () => {
      const model = makeOrderModel({
        frequency: { roleId: "r1", min: 2, max: 5 },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C001", r2: "O123" } }); // C001 appears once

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("population/frequency-violation");
      expect(diags[0]!.message).toContain("1 time(s)");
      expect(diags[0]!.message).toContain("minimum is 2");
    });

    it("reports when value appears more times than maximum", () => {
      const model = makeOrderModel({
        frequency: { roleId: "r1", min: 1, max: 2 },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C001", r2: "O123" } });
      pop.addInstance({ values: { r1: "C001", r2: "O124" } });
      pop.addInstance({ values: { r1: "C001", r2: "O125" } });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("population/frequency-violation");
      expect(diags[0]!.message).toContain("3 time(s)");
      expect(diags[0]!.message).toContain("maximum is 2");
    });

    it("passes when frequency is within bounds", () => {
      const model = makeOrderModel({
        frequency: { roleId: "r1", min: 2, max: 3 },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      pop.addInstance({ values: { r1: "C001", r2: "O123" } });
      pop.addInstance({ values: { r1: "C001", r2: "O124" } });

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });

    it("allows unbounded max", () => {
      const model = makeOrderModel({
        frequency: { roleId: "r1", min: 1, max: "unbounded" },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      for (let i = 0; i < 100; i++) {
        pop.addInstance({ values: { r1: "C001", r2: `O${i}` } });
      }

      const diags = populationValidationRules(model);
      expect(diags).toHaveLength(0);
    });
  });

  describe("combined constraints", () => {
    it("reports violations from multiple constraint types simultaneously", () => {
      const model = makeOrderModel({
        uniqueness: "role2",
        valueConstraint: { roleId: "r1", values: ["C001", "C002"] },
      });
      const ft = model.getFactTypeByName("Customer places Order")!;
      const pop = model.addPopulation({ factTypeId: ft.id });
      // Violates value constraint (C999) AND uniqueness (duplicate O123)
      pop.addInstance({
        id: "inst-1",
        values: { r1: "C001", r2: "O123" },
      });
      pop.addInstance({
        id: "inst-2",
        values: { r1: "C999", r2: "O123" },
      });

      const diags = populationValidationRules(model);
      // One uniqueness + one value constraint violation
      expect(diags).toHaveLength(2);
      const ruleIds = new Set(diags.map((d) => d.ruleId));
      expect(ruleIds).toContain("population/uniqueness-violation");
      expect(ruleIds).toContain("population/value-constraint-violation");
    });
  });
});
