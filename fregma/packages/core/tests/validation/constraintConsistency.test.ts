import { describe, it, expect } from "vitest";
import { constraintConsistencyRules } from "../../src/validation/rules/constraintConsistency.js";
import { OrmModel } from "../../src/model/OrmModel.js";

function buildModelWithConstraints(
  constraints: Array<Record<string, unknown>>,
): OrmModel {
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
    constraints: constraints as never,
  });
  return model;
}

describe("constraintConsistencyRules", () => {
  it("produces no diagnostics for valid constraints", () => {
    const model = buildModelWithConstraints([
      { type: "internal_uniqueness", roleIds: ["r1"] },
      { type: "mandatory", roleId: "r2" },
    ]);

    const diagnostics = constraintConsistencyRules(model);
    expect(diagnostics).toHaveLength(0);
  });

  it("produces no diagnostics for a model with no fact types", () => {
    const model = new OrmModel({ name: "Empty" });
    const diagnostics = constraintConsistencyRules(model);
    expect(diagnostics).toHaveLength(0);
  });

  describe("internal uniqueness", () => {
    it("detects a role id not in the fact type", () => {
      const model = buildModelWithConstraints([
        { type: "internal_uniqueness", roleIds: ["r999"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/internal-uniqueness-invalid-role",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.severity).toBe("error");
      expect(errors[0]!.message).toContain("r999");
    });

    it("detects multiple invalid role ids", () => {
      const model = buildModelWithConstraints([
        { type: "internal_uniqueness", roleIds: ["r999", "r888"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/internal-uniqueness-invalid-role",
      );
      expect(errors).toHaveLength(2);
    });

    it("warns when uniqueness spans all roles of a multi-role fact type", () => {
      const model = buildModelWithConstraints([
        { type: "internal_uniqueness", roleIds: ["r1", "r2"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const warnings = diagnostics.filter(
        (d) => d.ruleId === "constraint/spanning-all-roles",
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe("warning");
    });

    it("does not warn when uniqueness spans a subset of roles", () => {
      const model = buildModelWithConstraints([
        { type: "internal_uniqueness", roleIds: ["r1"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const warnings = diagnostics.filter(
        (d) => d.ruleId === "constraint/spanning-all-roles",
      );
      expect(warnings).toHaveLength(0);
    });
  });

  describe("mandatory", () => {
    it("detects a role id not in the fact type", () => {
      const model = buildModelWithConstraints([
        { type: "mandatory", roleId: "r999" },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/mandatory-invalid-role",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.severity).toBe("error");
      expect(errors[0]!.message).toContain("r999");
    });

    it("passes for a valid mandatory constraint", () => {
      const model = buildModelWithConstraints([
        { type: "mandatory", roleId: "r1" },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/mandatory-invalid-role",
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("value constraint", () => {
    it("detects a role id not in the fact type", () => {
      const model = buildModelWithConstraints([
        { type: "value_constraint", roleId: "r999", values: ["X"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/value-constraint-invalid-role",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.severity).toBe("error");
    });

    it("passes for a value constraint without role id", () => {
      const model = buildModelWithConstraints([
        { type: "value_constraint", values: ["X", "Y"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/value-constraint-invalid-role",
      );
      expect(errors).toHaveLength(0);
    });

    it("passes for a value constraint with a valid role id", () => {
      const model = buildModelWithConstraints([
        { type: "value_constraint", roleId: "r1", values: ["X"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "constraint/value-constraint-invalid-role",
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe("external uniqueness", () => {
    it("warns when all roles are local to the fact type", () => {
      const model = buildModelWithConstraints([
        { type: "external_uniqueness", roleIds: ["r1", "r2"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const warnings = diagnostics.filter(
        (d) => d.ruleId === "constraint/external-uniqueness-all-local",
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe("warning");
    });

    it("does not warn when some roles are from other fact types", () => {
      const model = buildModelWithConstraints([
        { type: "external_uniqueness", roleIds: ["r1", "r-other"] },
      ]);

      const diagnostics = constraintConsistencyRules(model);
      const warnings = diagnostics.filter(
        (d) => d.ruleId === "constraint/external-uniqueness-all-local",
      );
      expect(warnings).toHaveLength(0);
    });
  });
});
