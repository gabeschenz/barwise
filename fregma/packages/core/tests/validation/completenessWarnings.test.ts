/**
 * Tests for completeness warning rules.
 *
 * Completeness warnings are non-blocking hints that help modelers
 * identify areas needing attention. They flag:
 *   - Object types with no natural-language definition (info)
 *   - Fact types with no constraints at all (warning -- likely
 *     indicates the modeler forgot to specify cardinality)
 *   - Object types that do not participate in any fact type (info --
 *     "orphan" types that serve no purpose in the model)
 */
import { describe, it, expect } from "vitest";
import { completenessWarnings } from "../../src/validation/rules/completenessWarnings.js";
import { OrmModel } from "../../src/model/OrmModel.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("completenessWarnings", () => {
  it("produces no diagnostics for a well-defined model", () => {
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

    const diagnostics = completenessWarnings(model);
    expect(diagnostics).toHaveLength(0);
  });

  it("produces no diagnostics for an empty model", () => {
    const model = new OrmModel({ name: "Empty" });
    const diagnostics = completenessWarnings(model);
    expect(diagnostics).toHaveLength(0);
  });

  describe("missing object type definitions", () => {
    it("reports object types without definitions", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", {
          referenceMode: "order_number",
          definition: "A confirmed purchase.",
        })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
        })
        .build();

      const diagnostics = completenessWarnings(model);
      const missing = diagnostics.filter(
        (d) =>
          d.ruleId === "completeness/missing-object-type-definition",
      );
      expect(missing).toHaveLength(1);
      expect(missing[0]!.severity).toBe("info");
      expect(missing[0]!.message).toContain("Customer");
    });

    it("reports all object types missing definitions", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("A", { referenceMode: "a_id" })
        .withEntityType("B", { referenceMode: "b_id" })
        .withBinaryFactType("A relates B", {
          role1: { player: "A", name: "relates" },
          role2: { player: "B", name: "is related" },
        })
        .build();

      const diagnostics = completenessWarnings(model);
      const missing = diagnostics.filter(
        (d) =>
          d.ruleId === "completeness/missing-object-type-definition",
      );
      expect(missing).toHaveLength(2);
    });
  });

  describe("fact types without constraints", () => {
    it("warns when a fact type has no constraints", () => {
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({
        name: "Thing",
        kind: "entity",
        referenceMode: "thing_id",
        definition: "A thing.",
      });
      model.addFactType({
        name: "Thing exists",
        roles: [{ name: "exists", playerId: ot.id }],
        readings: ["{0} exists"],
        // no constraints
      });

      const diagnostics = completenessWarnings(model);
      const noConstraints = diagnostics.filter(
        (d) =>
          d.ruleId === "completeness/fact-type-without-constraints",
      );
      expect(noConstraints).toHaveLength(1);
      expect(noConstraints[0]!.severity).toBe("warning");
      expect(noConstraints[0]!.message).toContain("Thing exists");
    });

    it("does not warn when fact type has constraints", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("X", {
          referenceMode: "x_id",
          definition: "An X.",
        })
        .withEntityType("Y", {
          referenceMode: "y_id",
          definition: "A Y.",
        })
        .withBinaryFactType("X has Y", {
          role1: { player: "X", name: "has" },
          role2: { player: "Y", name: "of" },
          uniqueness: "role2",
        })
        .build();

      const diagnostics = completenessWarnings(model);
      const noConstraints = diagnostics.filter(
        (d) =>
          d.ruleId === "completeness/fact-type-without-constraints",
      );
      expect(noConstraints).toHaveLength(0);
    });
  });

  describe("isolated object types", () => {
    it("reports object types not participating in any fact type", () => {
      const model = new OrmModel({ name: "Test" });
      model.addObjectType({
        name: "Orphan",
        kind: "entity",
        referenceMode: "orphan_id",
        definition: "An isolated type.",
      });

      const diagnostics = completenessWarnings(model);
      const isolated = diagnostics.filter(
        (d) => d.ruleId === "completeness/isolated-object-type",
      );
      expect(isolated).toHaveLength(1);
      expect(isolated[0]!.severity).toBe("info");
      expect(isolated[0]!.message).toContain("Orphan");
    });

    it("does not report object types that participate in fact types", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("A", {
          referenceMode: "a_id",
          definition: "An A.",
        })
        .withEntityType("B", {
          referenceMode: "b_id",
          definition: "A B.",
        })
        .withBinaryFactType("A has B", {
          role1: { player: "A", name: "has" },
          role2: { player: "B", name: "of" },
          uniqueness: "role1",
        })
        .build();

      const diagnostics = completenessWarnings(model);
      const isolated = diagnostics.filter(
        (d) => d.ruleId === "completeness/isolated-object-type",
      );
      expect(isolated).toHaveLength(0);
    });
  });
});
