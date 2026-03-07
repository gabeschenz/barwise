/**
 * Tests for the structural validation rules.
 *
 * Structural rules are a safety net for models that may have been loaded
 * from external sources (YAML files, LLM output) which can bypass the
 * OrmModel constructor's referential-integrity checks. They detect:
 *   - Dangling role references (a role whose playerId points to a
 *     nonexistent object type)
 *   - Duplicate object type or fact type names
 *   - Binary fact types missing an inverse reading
 *
 * To trigger error paths, several tests inject invalid state directly
 * into OrmModel's private maps, simulating a corrupted deserialization.
 */
import { describe, expect, it } from "vitest";
import { FactType } from "../../src/model/FactType.js";
import { ObjectType } from "../../src/model/ObjectType.js";
import { OrmModel } from "../../src/model/OrmModel.js";
import { structuralRules } from "../../src/validation/rules/structural.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("structuralRules", () => {
  it("produces no diagnostics for a valid model", () => {
    const model = new ModelBuilder("Test")
      .withEntityType("Customer", { referenceMode: "customer_id" })
      .withEntityType("Order", { referenceMode: "order_number" })
      .withBinaryFactType("Customer places Order", {
        role1: { player: "Customer", name: "places" },
        role2: { player: "Order", name: "is placed by" },
        uniqueness: "role2",
        mandatory: "role2",
      })
      .build();

    const diagnostics = structuralRules(model);
    expect(diagnostics).toHaveLength(0);
  });

  it("produces no diagnostics for an empty model", () => {
    const model = new OrmModel({ name: "Empty" });
    const diagnostics = structuralRules(model);
    expect(diagnostics).toHaveLength(0);
  });

  describe("dangling role references", () => {
    it("reports no dangling references for a valid model", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Person", { referenceMode: "person_id" })
        .withBinaryFactType("Person mentors Person", {
          role1: { player: "Person", name: "mentors" },
          role2: { player: "Person", name: "is mentored by" },
        })
        .build();

      const diagnostics = structuralRules(model);
      const dangling = diagnostics.filter(
        (d) => d.ruleId === "structural/dangling-role-reference",
      );
      expect(dangling).toHaveLength(0);
    });

    it("detects a role referencing a nonexistent object type", () => {
      // FactType does not validate playerIds -- it just stores them.
      // We create a fact type with a bogus playerId and inject it
      // into the model to trigger the structural rule.
      const ot = new ObjectType({ name: "Customer", kind: "entity", referenceMode: "cid" });
      const ft = new FactType({
        name: "Customer places Order",
        roles: [
          { name: "places", playerId: ot.id },
          { name: "is placed by", playerId: "nonexistent-ot-id" },
        ],
        readings: ["{0} places {1}"],
      });

      const model = new OrmModel({ name: "Test" });
      model.addObjectType({ id: ot.id, name: "Customer", kind: "entity", referenceMode: "cid" });
      // Bypass addFactType validation by injecting directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any)._factTypes.set(ft.id, ft);

      const diagnostics = structuralRules(model);
      const dangling = diagnostics.filter(
        (d) => d.ruleId === "structural/dangling-role-reference",
      );
      expect(dangling).toHaveLength(1);
      expect(dangling[0]!.message).toContain("nonexistent-ot-id");
      expect(dangling[0]!.message).toContain("is placed by");
    });
  });

  describe("duplicate names", () => {
    it("reports no duplicates in a model with unique names", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .build();

      const diagnostics = structuralRules(model);
      const dupes = diagnostics.filter((d) => d.ruleId.includes("duplicate"));
      expect(dupes).toHaveLength(0);
    });

    it("detects duplicate object type names", () => {
      // OrmModel.addObjectType prevents duplicates, so we inject directly.
      const ot1 = new ObjectType({ name: "Customer", kind: "entity", referenceMode: "cid1" });
      const ot2 = new ObjectType({ name: "Customer", kind: "entity", referenceMode: "cid2" });

      const model = new OrmModel({ name: "Test" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any)._objectTypes.set(ot1.id, ot1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any)._objectTypes.set(ot2.id, ot2);

      const diagnostics = structuralRules(model);
      const dupes = diagnostics.filter(
        (d) => d.ruleId === "structural/duplicate-object-type-name",
      );
      expect(dupes).toHaveLength(1);
      expect(dupes[0]!.message).toContain("Customer");
    });

    it("detects duplicate fact type names", () => {
      const ot = new ObjectType({ name: "Customer", kind: "entity", referenceMode: "cid" });
      const ft1 = new FactType({
        name: "Customer exists",
        roles: [{ name: "exists", playerId: ot.id }],
        readings: ["{0} exists"],
      });
      const ft2 = new FactType({
        name: "Customer exists",
        roles: [{ name: "exists", playerId: ot.id }],
        readings: ["{0} exists"],
      });

      const model = new OrmModel({ name: "Test" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any)._objectTypes.set(ot.id, ot);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any)._factTypes.set(ft1.id, ft1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model as any)._factTypes.set(ft2.id, ft2);

      const diagnostics = structuralRules(model);
      const dupes = diagnostics.filter(
        (d) => d.ruleId === "structural/duplicate-fact-type-name",
      );
      expect(dupes).toHaveLength(1);
      expect(dupes[0]!.message).toContain("Customer exists");
    });
  });

  describe("binary fact type readings", () => {
    it("warns when a binary fact type has only one reading", () => {
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

      model.addFactType({
        name: "Customer places Order",
        roles: [
          { name: "places", playerId: customer.id },
          { name: "is placed by", playerId: order.id },
        ],
        readings: ["{0} places {1}"], // only forward reading
      });

      const diagnostics = structuralRules(model);
      const readingWarnings = diagnostics.filter(
        (d) => d.ruleId === "structural/binary-missing-inverse-reading",
      );
      expect(readingWarnings).toHaveLength(1);
      expect(readingWarnings[0]!.severity).toBe("warning");
      expect(readingWarnings[0]!.message).toContain(
        "Customer places Order",
      );
    });

    it("does not warn for unary fact types with one reading", () => {
      const model = new OrmModel({ name: "Test" });
      const person = model.addObjectType({
        name: "Person",
        kind: "entity",
        referenceMode: "person_id",
      });

      model.addFactType({
        name: "Person smokes",
        roles: [{ name: "smokes", playerId: person.id }],
        readings: ["{0} smokes"],
      });

      const diagnostics = structuralRules(model);
      const readingWarnings = diagnostics.filter(
        (d) => d.ruleId === "structural/binary-missing-inverse-reading",
      );
      expect(readingWarnings).toHaveLength(0);
    });

    it("does not warn for binary fact types with two readings", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("A", { referenceMode: "a_id" })
        .withEntityType("B", { referenceMode: "b_id" })
        .withBinaryFactType("A relates to B", {
          role1: { player: "A", name: "relates to" },
          role2: { player: "B", name: "is related from" },
        })
        .build();

      const diagnostics = structuralRules(model);
      const readingWarnings = diagnostics.filter(
        (d) => d.ruleId === "structural/binary-missing-inverse-reading",
      );
      expect(readingWarnings).toHaveLength(0);
    });
  });
});
