import { describe, it, expect } from "vitest";
import { parseDraftModel } from "../src/DraftModelParser.js";
import type { ExtractionResponse } from "../src/ExtractionTypes.js";

function makeResponse(
  overrides: Partial<ExtractionResponse> = {},
): ExtractionResponse {
  return {
    object_types: overrides.object_types ?? [],
    fact_types: overrides.fact_types ?? [],
    inferred_constraints: overrides.inferred_constraints ?? [],
    ambiguities: overrides.ambiguities ?? [],
  };
}

describe("DraftModelParser", () => {
  describe("object type creation", () => {
    it("creates entity types with reference mode", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Customer",
              kind: "entity",
              reference_mode: "customer_id",
              definition: "A buyer",
              source_references: [{ lines: [1, 2], excerpt: "customer" }],
            },
          ],
        }),
        "Test",
      );

      expect(result.model.objectTypes).toHaveLength(1);
      const ot = result.model.getObjectTypeByName("Customer");
      expect(ot).toBeDefined();
      expect(ot?.kind).toBe("entity");
      expect(ot?.referenceMode).toBe("customer_id");
      expect(ot?.definition).toBe("A buyer");
    });

    it("creates value types without reference mode", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Rating",
              kind: "value",
              value_constraint: { values: ["A", "B", "C"] },
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      const ot = result.model.getObjectTypeByName("Rating");
      expect(ot).toBeDefined();
      expect(ot?.kind).toBe("value");
      expect(ot?.valueConstraint?.values).toEqual(["A", "B", "C"]);
    });

    it("auto-generates reference mode for entity types without one", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Order",
              kind: "entity",
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      const ot = result.model.getObjectTypeByName("Order");
      expect(ot?.referenceMode).toBe("order_id");
    });

    it("skips object types with empty names", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "", kind: "entity", source_references: [] },
          ],
        }),
        "Test",
      );

      expect(result.model.objectTypes).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("records provenance for each object type", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Customer",
              kind: "entity",
              reference_mode: "cid",
              source_references: [
                { lines: [5, 7], excerpt: "each customer has a unique ID" },
              ],
            },
          ],
        }),
        "Test",
      );

      expect(result.objectTypeProvenance).toHaveLength(1);
      expect(result.objectTypeProvenance[0]?.elementName).toBe("Customer");
      expect(result.objectTypeProvenance[0]?.sourceReferences).toHaveLength(1);
    });
  });

  describe("fact type creation", () => {
    it("creates binary fact types with resolved role players", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "Customer", kind: "entity", reference_mode: "cid", source_references: [] },
            { name: "Order", kind: "entity", reference_mode: "oid", source_references: [] },
          ],
          fact_types: [
            {
              name: "Customer places Order",
              roles: [
                { player: "Customer", role_name: "places" },
                { player: "Order", role_name: "is placed by" },
              ],
              readings: ["{0} places {1}", "{1} is placed by {0}"],
              source_references: [{ lines: [3, 3], excerpt: "places" }],
            },
          ],
        }),
        "Test",
      );

      expect(result.model.factTypes).toHaveLength(1);
      const ft = result.model.getFactTypeByName("Customer places Order");
      expect(ft).toBeDefined();
      expect(ft?.roles).toHaveLength(2);
      expect(ft?.readings).toHaveLength(2);
    });

    it("warns and skips fact types with unresolved players", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "Customer", kind: "entity", reference_mode: "cid", source_references: [] },
          ],
          fact_types: [
            {
              name: "Customer places Order",
              roles: [
                { player: "Customer", role_name: "places" },
                { player: "Order", role_name: "is placed by" },
              ],
              readings: ["{0} places {1}"],
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      expect(result.model.factTypes).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("Order"))).toBe(true);
    });

    it("generates default reading when none provided", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "Customer", kind: "entity", reference_mode: "cid", source_references: [] },
            { name: "Order", kind: "entity", reference_mode: "oid", source_references: [] },
          ],
          fact_types: [
            {
              name: "Customer places Order",
              roles: [
                { player: "Customer", role_name: "places" },
                { player: "Order", role_name: "is placed by" },
              ],
              readings: [],
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      expect(result.model.factTypes).toHaveLength(1);
      const ft = result.model.getFactTypeByName("Customer places Order");
      expect(ft?.readings).toHaveLength(1);
    });

    it("discards readings with missing placeholders", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "A", kind: "entity", reference_mode: "aid", source_references: [] },
            { name: "B", kind: "entity", reference_mode: "bid", source_references: [] },
          ],
          fact_types: [
            {
              name: "A relates B",
              roles: [
                { player: "A", role_name: "relates" },
                { player: "B", role_name: "is related to" },
              ],
              readings: ["A relates to B"],  // Missing {0}, {1}
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      // Invalid reading discarded, default generated.
      expect(result.model.factTypes).toHaveLength(1);
      expect(result.warnings.some((w) => w.includes("placeholder"))).toBe(true);
    });

    it("skips fact types with no roles", () => {
      const result = parseDraftModel(
        makeResponse({
          fact_types: [
            {
              name: "Empty",
              roles: [],
              readings: [],
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      expect(result.model.factTypes).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("no roles"))).toBe(true);
    });
  });

  describe("constraint application", () => {
    function makeModelWithFactType() {
      return makeResponse({
        object_types: [
          { name: "Customer", kind: "entity", reference_mode: "cid", source_references: [] },
          { name: "Order", kind: "entity", reference_mode: "oid", source_references: [] },
        ],
        fact_types: [
          {
            name: "Customer places Order",
            roles: [
              { player: "Customer", role_name: "places" },
              { player: "Order", role_name: "is placed by" },
            ],
            readings: ["{0} places {1}"],
            source_references: [],
          },
        ],
      });
    }

    it("applies internal uniqueness constraints", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "internal_uniqueness",
              fact_type: "Customer places Order",
              roles: ["is placed by"],
              description: "Each Order is placed by at most one Customer.",
              confidence: "high",
              source_references: [{ lines: [3, 3], excerpt: "exactly one" }],
            },
          ],
        },
        "Test",
      );

      const ft = result.model.getFactTypeByName("Customer places Order");
      const uc = ft?.constraints.find((c) => c.type === "internal_uniqueness");
      expect(uc).toBeDefined();

      expect(result.constraintProvenance[0]?.applied).toBe(true);
      expect(result.constraintProvenance[0]?.confidence).toBe("high");
    });

    it("applies mandatory constraints", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "mandatory",
              fact_type: "Customer places Order",
              roles: ["is placed by"],
              description: "Every Order is placed by some Customer.",
              confidence: "high",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      const ft = result.model.getFactTypeByName("Customer places Order");
      const mc = ft?.constraints.find((c) => c.type === "mandatory");
      expect(mc).toBeDefined();

      expect(result.constraintProvenance[0]?.applied).toBe(true);
    });

    it("records skip reason for constraints on missing fact types", () => {
      const result = parseDraftModel(
        makeResponse({
          inferred_constraints: [
            {
              type: "mandatory",
              fact_type: "NonExistent FT",
              roles: ["role1"],
              description: "Some constraint",
              confidence: "low",
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      expect(result.constraintProvenance[0]?.applied).toBe(false);
      expect(result.constraintProvenance[0]?.skipReason).toContain(
        "not found",
      );
    });
  });

  describe("ambiguities", () => {
    it("passes through ambiguities from the extraction", () => {
      const result = parseDraftModel(
        makeResponse({
          ambiguities: [
            {
              description: "Customer vs Client terminology",
              source_references: [
                { lines: [17, 19], excerpt: "client or customer" },
              ],
            },
          ],
        }),
        "Test",
      );

      expect(result.ambiguities).toHaveLength(1);
      expect(result.ambiguities[0]?.description).toContain("Customer");
    });
  });

  describe("edge cases", () => {
    it("handles empty extraction response", () => {
      const result = parseDraftModel(makeResponse(), "Empty");
      expect(result.model.objectTypes).toHaveLength(0);
      expect(result.model.factTypes).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("handles duplicate object type names gracefully", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "Customer", kind: "entity", reference_mode: "cid", source_references: [] },
            { name: "Customer", kind: "entity", reference_mode: "cid2", source_references: [] },
          ],
        }),
        "Test",
      );

      // First one succeeds, second one produces a warning.
      expect(result.model.objectTypes).toHaveLength(1);
      expect(result.warnings.some((w) => w.includes("Customer"))).toBe(true);
    });
  });
});
