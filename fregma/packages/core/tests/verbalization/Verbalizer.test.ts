import { describe, it, expect } from "vitest";
import { Verbalizer } from "../../src/verbalization/Verbalizer.js";
import { OrmModel } from "../../src/model/OrmModel.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("Verbalizer", () => {
  const verbalizer = new Verbalizer();

  describe("verbalizeModel", () => {
    it("returns empty array for a model with no fact types", () => {
      const model = new OrmModel({ name: "Empty" });
      expect(verbalizer.verbalizeModel(model)).toHaveLength(0);
    });

    it("returns fact type readings and constraint verbalizations", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
          mandatory: "role1",
        })
        .build();

      const vs = verbalizer.verbalizeModel(model);

      // 2 readings + 1 uniqueness + 1 mandatory = 4
      expect(vs).toHaveLength(4);

      const factTypeVs = vs.filter((v) => v.category === "fact_type");
      const constraintVs = vs.filter((v) => v.category === "constraint");

      expect(factTypeVs).toHaveLength(2);
      expect(constraintVs).toHaveLength(2);
    });

    it("handles multiple fact types", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withEntityType("Product", { referenceMode: "product_id" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
        })
        .withBinaryFactType("Order contains Product", {
          role1: { player: "Order", name: "contains" },
          role2: { player: "Product", name: "is in" },
        })
        .build();

      const vs = verbalizer.verbalizeModel(model);

      // 2 readings per fact type * 2 fact types = 4
      expect(vs).toHaveLength(4);
      expect(vs.map((v) => v.text)).toContain("Customer places Order");
      expect(vs.map((v) => v.text)).toContain(
        "Order is placed by Customer",
      );
      expect(vs.map((v) => v.text)).toContain("Order contains Product");
      expect(vs.map((v) => v.text)).toContain("Product is in Order");
    });
  });

  describe("verbalizeFactType", () => {
    it("returns empty array for nonexistent fact type", () => {
      const model = new OrmModel({ name: "Test" });
      expect(verbalizer.verbalizeFactType("bogus", model)).toHaveLength(
        0,
      );
    });

    it("returns readings and constraints for a specific fact type", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
        })
        .build();

      const ft = model.factTypes[0]!;
      const vs = verbalizer.verbalizeFactType(ft.id, model);

      // 2 readings + 1 uniqueness = 3
      expect(vs).toHaveLength(3);
      expect(vs[0]!.text).toBe("Customer places Order");
      expect(vs[1]!.text).toBe("Order is placed by Customer");
      expect(vs[2]!.text).toContain("at most one");
    });
  });

  describe("sub-verbalizer access", () => {
    it("exposes factTypes verbalizer", () => {
      expect(verbalizer.factTypes).toBeDefined();
    });

    it("exposes constraints verbalizer", () => {
      expect(verbalizer.constraints).toBeDefined();
    });
  });
});
