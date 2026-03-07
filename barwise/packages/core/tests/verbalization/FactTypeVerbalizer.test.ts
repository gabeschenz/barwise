/**
 * Tests for the FactTypeVerbalizer.
 *
 * FactTypeVerbalizer expands reading templates into human-readable
 * sentences (e.g. "{0} places {1}" -> "Customer places Order") and
 * produces structured segments that link each text span back to the
 * model element it represents. These tests verify:
 *   - Forward and inverse reading expansion
 *   - Structured segment generation (object_type_ref vs text spans)
 *   - Segment element IDs linking back to the correct object types
 *   - Unary and self-referencing fact types
 */
import { describe, expect, it } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";
import { FactTypeVerbalizer } from "../../src/verbalization/FactTypeVerbalizer.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("FactTypeVerbalizer", () => {
  const verbalizer = new FactTypeVerbalizer();

  describe("verbalizePrimary", () => {
    it("verbalizes a binary fact type forward reading", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
        })
        .build();

      const ft = model.factTypes[0]!;
      const v = verbalizer.verbalizePrimary(ft, model);

      expect(v.text).toBe("Customer places Order");
      expect(v.category).toBe("fact_type");
      expect(v.sourceElementId).toBe(ft.id);
    });

    it("produces structured segments with object type refs", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
        })
        .build();

      const ft = model.factTypes[0]!;
      const v = verbalizer.verbalizePrimary(ft, model);

      expect(v.segments).toHaveLength(3);
      expect(v.segments[0]).toEqual(
        expect.objectContaining({ text: "Customer", kind: "object_type_ref" }),
      );
      expect(v.segments[1]).toEqual(
        expect.objectContaining({ text: " places ", kind: "text" }),
      );
      expect(v.segments[2]).toEqual(
        expect.objectContaining({ text: "Order", kind: "object_type_ref" }),
      );
    });

    it("links segments to the correct object type ids", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
        })
        .build();

      const ft = model.factTypes[0]!;
      const customerOt = model.getObjectTypeByName("Customer")!;
      const orderOt = model.getObjectTypeByName("Order")!;
      const v = verbalizer.verbalizePrimary(ft, model);

      const refs = v.segments.filter((s) => s.kind === "object_type_ref");
      expect(refs[0]!.elementId).toBe(customerOt.id);
      expect(refs[1]!.elementId).toBe(orderOt.id);
    });
  });

  describe("verbalizeAll", () => {
    it("returns one verbalization per reading", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "customer_id" })
        .withEntityType("Order", { referenceMode: "order_number" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
        })
        .build();

      const ft = model.factTypes[0]!;
      const vs = verbalizer.verbalizeAll(ft, model);

      expect(vs).toHaveLength(2);
      expect(vs[0]!.text).toBe("Customer places Order");
      expect(vs[1]!.text).toBe("Order is placed by Customer");
    });

    it("handles a unary fact type", () => {
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

      const ft = model.factTypes[0]!;
      const vs = verbalizer.verbalizeAll(ft, model);

      expect(vs).toHaveLength(1);
      expect(vs[0]!.text).toBe("Person smokes");
    });

    it("handles a self-referencing fact type", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Person", { referenceMode: "person_id" })
        .withBinaryFactType("Person mentors Person", {
          role1: { player: "Person", name: "mentors" },
          role2: { player: "Person", name: "is mentored by" },
        })
        .build();

      const ft = model.factTypes[0]!;
      const vs = verbalizer.verbalizeAll(ft, model);

      expect(vs[0]!.text).toBe("Person mentors Person");
      expect(vs[1]!.text).toBe("Person is mentored by Person");
    });
  });
});
