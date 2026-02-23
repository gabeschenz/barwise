import { describe, it, expect } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";

describe("OrmModel", () => {
  describe("construction", () => {
    it("creates a model with a name", () => {
      const model = new OrmModel({ name: "Test Model" });
      expect(model.name).toBe("Test Model");
    });

    it("accepts a domain context", () => {
      const model = new OrmModel({ name: "Test", domainContext: "crm" });
      expect(model.domainContext).toBe("crm");
    });

    it("throws on empty name", () => {
      expect(() => new OrmModel({ name: "" })).toThrow("non-empty");
    });

    it("starts with no elements", () => {
      const model = new OrmModel({ name: "Empty" });
      expect(model.objectTypes).toHaveLength(0);
      expect(model.factTypes).toHaveLength(0);
      expect(model.definitions).toHaveLength(0);
      expect(model.elementCount).toBe(0);
    });
  });

  describe("object types", () => {
    it("adds an entity type", () => {
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      expect(model.objectTypes).toHaveLength(1);
      expect(model.getObjectType(ot.id)).toBe(ot);
      expect(model.getObjectTypeByName("Customer")).toBe(ot);
    });

    it("adds a value type", () => {
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({ name: "Rating", kind: "value" });
      expect(ot.isValue).toBe(true);
    });

    it("rejects duplicate object type names", () => {
      const model = new OrmModel({ name: "Test" });
      model.addObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      expect(() =>
        model.addObjectType({
          name: "Customer",
          kind: "entity",
          referenceMode: "cust_id",
        }),
      ).toThrow("already exists");
    });

    it("removes an unreferenced object type", () => {
      const model = new OrmModel({ name: "Test" });
      const ot = model.addObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      model.removeObjectType(ot.id);
      expect(model.objectTypes).toHaveLength(0);
    });

    it("throws when removing a nonexistent object type", () => {
      const model = new OrmModel({ name: "Test" });
      expect(() => model.removeObjectType("nonexistent")).toThrow("not found");
    });

    it("throws when removing an object type referenced by a fact type", () => {
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
        readings: ["{0} places {1}"],
      });

      expect(() => model.removeObjectType(customer.id)).toThrow(
        "referenced by",
      );
    });
  });

  describe("fact types", () => {
    function modelWithTypes() {
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
      return { model, customer, order };
    }

    it("adds a fact type with valid player references", () => {
      const { model, customer, order } = modelWithTypes();
      const ft = model.addFactType({
        name: "Customer places Order",
        roles: [
          { name: "places", playerId: customer.id },
          { name: "is placed by", playerId: order.id },
        ],
        readings: ["{0} places {1}"],
      });
      expect(model.factTypes).toHaveLength(1);
      expect(model.getFactType(ft.id)).toBe(ft);
    });

    it("throws if a role references a nonexistent object type", () => {
      const { model } = modelWithTypes();
      expect(() =>
        model.addFactType({
          name: "Bad Reference",
          roles: [
            { name: "r1", playerId: "nonexistent-id" },
            { name: "r2", playerId: "also-nonexistent" },
          ],
          readings: ["{0} test {1}"],
        }),
      ).toThrow("does not exist");
    });

    it("rejects duplicate fact type names", () => {
      const { model, customer, order } = modelWithTypes();
      model.addFactType({
        name: "Customer places Order",
        roles: [
          { name: "places", playerId: customer.id },
          { name: "is placed by", playerId: order.id },
        ],
        readings: ["{0} places {1}"],
      });
      expect(() =>
        model.addFactType({
          name: "Customer places Order",
          roles: [
            { name: "places", playerId: customer.id },
            { name: "is placed by", playerId: order.id },
          ],
          readings: ["{0} places {1}"],
        }),
      ).toThrow("already exists");
    });

    it("removes a fact type", () => {
      const { model, customer, order } = modelWithTypes();
      const ft = model.addFactType({
        name: "Customer places Order",
        roles: [
          { name: "places", playerId: customer.id },
          { name: "is placed by", playerId: order.id },
        ],
        readings: ["{0} places {1}"],
      });
      model.removeFactType(ft.id);
      expect(model.factTypes).toHaveLength(0);
    });

    it("throws when removing a nonexistent fact type", () => {
      const { model } = modelWithTypes();
      expect(() => model.removeFactType("nonexistent")).toThrow("not found");
    });
  });

  describe("definitions", () => {
    it("adds a ubiquitous language definition", () => {
      const model = new OrmModel({ name: "Test" });
      model.addDefinition({
        term: "Backorder",
        definition: "An order that cannot be fulfilled from current inventory.",
        context: "fulfillment",
      });
      expect(model.definitions).toHaveLength(1);
      expect(model.definitions[0]?.term).toBe("Backorder");
    });

    it("throws on empty term", () => {
      const model = new OrmModel({ name: "Test" });
      expect(() =>
        model.addDefinition({ term: "", definition: "Something." }),
      ).toThrow("non-empty");
    });

    it("throws on empty definition text", () => {
      const model = new OrmModel({ name: "Test" });
      expect(() =>
        model.addDefinition({ term: "Valid", definition: "" }),
      ).toThrow("non-empty");
    });
  });

  describe("property setters", () => {
    it("sets the model name", () => {
      const model = new OrmModel({ name: "Original" });
      model.name = "Updated";
      expect(model.name).toBe("Updated");
    });

    it("trims the model name on set", () => {
      const model = new OrmModel({ name: "Original" });
      model.name = "  Trimmed  ";
      expect(model.name).toBe("Trimmed");
    });

    it("throws when setting name to empty string", () => {
      const model = new OrmModel({ name: "Test" });
      expect(() => { model.name = ""; }).toThrow("non-empty");
    });

    it("throws when setting name to whitespace", () => {
      const model = new OrmModel({ name: "Test" });
      expect(() => { model.name = "   "; }).toThrow("non-empty");
    });

    it("sets domainContext", () => {
      const model = new OrmModel({ name: "Test" });
      expect(model.domainContext).toBeUndefined();
      model.domainContext = "crm";
      expect(model.domainContext).toBe("crm");
    });

    it("clears domainContext by setting undefined", () => {
      const model = new OrmModel({ name: "Test", domainContext: "crm" });
      expect(model.domainContext).toBe("crm");
      model.domainContext = undefined;
      expect(model.domainContext).toBeUndefined();
    });
  });

  describe("queries", () => {
    it("finds fact types for an object type", () => {
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
      const product = model.addObjectType({
        name: "Product",
        kind: "entity",
        referenceMode: "product_id",
      });

      model.addFactType({
        name: "Customer places Order",
        roles: [
          { name: "places", playerId: customer.id },
          { name: "is placed by", playerId: order.id },
        ],
        readings: ["{0} places {1}"],
      });
      model.addFactType({
        name: "Order contains Product",
        roles: [
          { name: "contains", playerId: order.id },
          { name: "is contained in", playerId: product.id },
        ],
        readings: ["{0} contains {1}"],
      });

      // Customer participates in 1 fact type.
      expect(model.factTypesForObjectType(customer.id)).toHaveLength(1);
      // Order participates in 2 fact types.
      expect(model.factTypesForObjectType(order.id)).toHaveLength(2);
      // Product participates in 1 fact type.
      expect(model.factTypesForObjectType(product.id)).toHaveLength(1);
    });

    it("reports element count", () => {
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
        readings: ["{0} places {1}"],
      });
      model.addDefinition({
        term: "Test",
        definition: "A test definition.",
      });

      // 2 object types + 1 fact type + 1 definition = 4
      expect(model.elementCount).toBe(4);
    });
  });
});
