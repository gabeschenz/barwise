/**
 * Tests for the ObjectType model class.
 *
 * ObjectType represents either an entity type (identified by a reference
 * mode) or a value type (self-identifying). These tests verify:
 *   - Construction of both entity and value types
 *   - Setter behavior for mutable properties (name, definition, etc.)
 *   - Validation of required fields (entity types must have a referenceMode)
 *   - Value constraints on value types
 *   - Source-context tracking for multi-domain models
 */
import { describe, it, expect } from "vitest";
import { ObjectType } from "../../src/model/ObjectType.js";

describe("ObjectType", () => {
  describe("entity types", () => {
    it("creates an entity type with a reference mode", () => {
      const ot = new ObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      expect(ot.name).toBe("Customer");
      expect(ot.kind).toBe("entity");
      expect(ot.referenceMode).toBe("customer_id");
      expect(ot.isEntity).toBe(true);
      expect(ot.isValue).toBe(false);
    });

    it("throws if entity type has no reference mode", () => {
      expect(
        () => new ObjectType({ name: "Customer", kind: "entity" }),
      ).toThrow("reference mode");
    });

    it("accepts a definition", () => {
      const ot = new ObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
        definition: "A person or org that has placed at least one order.",
      });
      expect(ot.definition).toBe(
        "A person or org that has placed at least one order.",
      );
    });

    it("accepts a source context", () => {
      const ot = new ObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
        sourceContext: "crm",
      });
      expect(ot.sourceContext).toBe("crm");
    });
  });

  describe("value types", () => {
    it("creates a value type without a reference mode", () => {
      const ot = new ObjectType({ name: "Name", kind: "value" });
      expect(ot.kind).toBe("value");
      expect(ot.referenceMode).toBeUndefined();
      expect(ot.isValue).toBe(true);
      expect(ot.isEntity).toBe(false);
    });

    it("throws if value type has a reference mode", () => {
      expect(
        () =>
          new ObjectType({
            name: "Name",
            kind: "value",
            referenceMode: "name_id",
          }),
      ).toThrow("should not have a reference mode");
    });

    it("accepts a value constraint", () => {
      const ot = new ObjectType({
        name: "Rating",
        kind: "value",
        valueConstraint: { values: ["A", "B", "C", "D", "F"] },
      });
      expect(ot.valueConstraint).toBeDefined();
      expect(ot.valueConstraint!.values).toEqual(["A", "B", "C", "D", "F"]);
    });

    it("throws on empty value constraint", () => {
      expect(
        () =>
          new ObjectType({
            name: "Rating",
            kind: "value",
            valueConstraint: { values: [] },
          }),
      ).toThrow("at least one value");
    });
  });

  describe("mutability", () => {
    it("allows updating the definition", () => {
      const ot = new ObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      expect(ot.definition).toBeUndefined();
      ot.definition = "Updated definition.";
      expect(ot.definition).toBe("Updated definition.");
    });

    it("allows updating the source context", () => {
      const ot = new ObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      ot.sourceContext = "billing";
      expect(ot.sourceContext).toBe("billing");
    });
  });
});
