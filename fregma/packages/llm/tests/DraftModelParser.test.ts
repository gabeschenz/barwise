/**
 * Tests for the DraftModelParser, which converts raw LLM extraction
 * output into a validated OrmModel with provenance metadata.
 *
 * The parser resolves LLM-generated role names to actual role IDs,
 * applies constraints with confidence tracking, and records skip reasons
 * when constraints cannot be applied. These tests verify:
 *   - Object type and fact type creation from extraction responses
 *   - Constraint resolution (by name match and positional fallback)
 *   - Provenance recording for every element
 *   - Edge cases: empty names, duplicate names, unresolvable roles
 *   - Skip-reason tracking for constraints that cannot be applied
 */
import { describe, it, expect } from "vitest";
import { parseDraftModel } from "../src/DraftModelParser.js";
import type { ExtractionResponse } from "../src/ExtractionTypes.js";

/** Builds a minimal ExtractionResponse with defaults for omitted fields. */
function makeResponse(
  overrides: Partial<ExtractionResponse> = {},
): ExtractionResponse {
  return {
    object_types: overrides.object_types ?? [],
    fact_types: overrides.fact_types ?? [],
    subtypes: overrides.subtypes ?? [],
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

    it("creates value types with data_type", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Amount",
              kind: "value",
              data_type: { name: "decimal", length: 10, scale: 2 },
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      const ot = result.model.getObjectTypeByName("Amount");
      expect(ot).toBeDefined();
      expect(ot?.dataType).toEqual({ name: "decimal", length: 10, scale: 2 });
    });

    it("creates value types with simple data_type (no length/scale)", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "BirthDate",
              kind: "value",
              data_type: { name: "date" },
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      const ot = result.model.getObjectTypeByName("BirthDate");
      expect(ot?.dataType).toEqual({ name: "date" });
    });

    it("ignores unrecognized data_type names with a warning", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Foo",
              kind: "value",
              data_type: { name: "varchar" } as never,
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      const ot = result.model.getObjectTypeByName("Foo");
      expect(ot?.dataType).toBeUndefined();
      expect(result.warnings.some((w) => w.includes("unrecognized data type"))).toBe(true);
    });

    it("handles missing data_type gracefully", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            {
              name: "Name",
              kind: "value",
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      const ot = result.model.getObjectTypeByName("Name");
      expect(ot?.dataType).toBeUndefined();
      expect(result.warnings).toHaveLength(0);
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

    it("applies internal uniqueness with is_preferred", () => {
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
              is_preferred: true,
              source_references: [],
            },
          ],
        },
        "Test",
      );

      const ft = result.model.getFactTypeByName("Customer places Order");
      const uc = ft?.constraints.find((c) => c.type === "internal_uniqueness");
      expect(uc).toBeDefined();
      expect(uc?.type === "internal_uniqueness" && uc.isPreferred).toBe(true);
      expect(result.constraintProvenance[0]?.applied).toBe(true);
    });

    it("omits isPreferred when is_preferred is not set", () => {
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
              source_references: [],
            },
          ],
        },
        "Test",
      );

      const ft = result.model.getFactTypeByName("Customer places Order");
      const uc = ft?.constraints.find((c) => c.type === "internal_uniqueness");
      expect(uc).toBeDefined();
      expect(uc?.type === "internal_uniqueness" && uc.isPreferred).toBeFalsy();
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

  describe("constraint resolution edge cases", () => {
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

    it("skips constraint when role hint matches neither role name nor player name", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "internal_uniqueness",
              fact_type: "Customer places Order",
              // Use a name that won't match any role name or player name.
              roles: ["SomeUnknownRole"],
              description: "Uniqueness with unresolvable role name",
              confidence: "medium",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      // Should NOT apply -- no blind fallback.
      expect(result.constraintProvenance[0]?.applied).toBe(false);
      expect(result.warnings.some((w) => w.includes("could not resolve"))).toBe(true);
    });

    it("resolves constraint role by player object type name", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "internal_uniqueness",
              fact_type: "Customer places Order",
              // Use the player name (object type name), not the role name.
              roles: ["Order"],
              description: "Each Order is placed by at most one Customer.",
              confidence: "high",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      // Should resolve via player name lookup.
      expect(result.constraintProvenance[0]?.applied).toBe(true);
      const ft = result.model.getFactTypeByName("Customer places Order")!;
      const uc = ft.constraints.find((c) => c.type === "internal_uniqueness");
      expect(uc).toBeDefined();
      // The constraint should be on the Order role (role index 1).
      const orderRole = ft.roles.find((r) => r.name === "is placed by")!;
      if (uc?.type === "internal_uniqueness") {
        expect(uc.roleIds).toContain(orderRole.id);
      }
    });

    it("records skip reason when mandatory has too many roles", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "mandatory",
              fact_type: "Customer places Order",
              roles: ["places", "is placed by"],
              description: "Mandatory with two roles (invalid)",
              confidence: "high",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.constraintProvenance[0]?.applied).toBe(false);
      expect(result.constraintProvenance[0]?.skipReason).toContain("exactly one role");
    });

    it("records skip reason when mandatory role cannot be resolved", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "mandatory",
              fact_type: "Customer places Order",
              // Use a name that won't match any role name or player name.
              roles: ["CompletelyFake"],
              description: "Mandatory with unresolvable role",
              confidence: "low",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      // No blind fallback -- should not apply.
      expect(result.constraintProvenance[0]?.applied).toBe(false);
      expect(result.constraintProvenance[0]?.skipReason).toContain("Could not resolve");
    });

    it("records skip reason for internal_uniqueness with no resolvable roles", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "internal_uniqueness",
              fact_type: "Customer places Order",
              // Empty roles array means nothing to resolve.
              roles: [],
              description: "Uniqueness with empty roles",
              confidence: "low",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.constraintProvenance[0]?.applied).toBe(false);
      expect(result.constraintProvenance[0]?.skipReason).toContain("Could not resolve");
    });

    it("skips value_constraint on fact type roles", () => {
      const resp = makeModelWithFactType();
      const result = parseDraftModel(
        {
          ...resp,
          inferred_constraints: [
            {
              type: "value_constraint",
              fact_type: "Customer places Order",
              roles: ["places"],
              description: "Value constraint on role",
              confidence: "medium",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.constraintProvenance[0]?.applied).toBe(false);
      expect(result.constraintProvenance[0]?.skipReason).toContain("not yet supported");
    });

    it("skips fact type with empty name", () => {
      const result = parseDraftModel(
        makeResponse({
          object_types: [
            { name: "A", kind: "entity", reference_mode: "aid", source_references: [] },
          ],
          fact_types: [
            {
              name: "",
              roles: [{ player: "A", role_name: "does" }],
              readings: ["{0} does"],
              source_references: [],
            },
          ],
        }),
        "Test",
      );

      expect(result.model.factTypes).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("empty name"))).toBe(true);
    });
  });

  describe("subtype extraction", () => {
    function makeModelWithEntities() {
      return makeResponse({
        object_types: [
          { name: "Person", kind: "entity", reference_mode: "person_id", source_references: [] },
          { name: "Employee", kind: "entity", reference_mode: "employee_id", source_references: [] },
          { name: "Manager", kind: "entity", reference_mode: "manager_id", source_references: [] },
          { name: "Rating", kind: "value", source_references: [] },
        ],
      });
    }

    it("creates subtype facts from extracted subtypes", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Employee",
              supertype: "Person",
              description: "Employee is a Person",
              source_references: [{ lines: [5, 5], excerpt: "employee is a person" }],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(1);
      const sf = result.model.subtypeFacts[0]!;
      expect(sf.providesIdentification).toBe(true);

      const subtypeOt = result.model.getObjectTypeByName("Employee");
      const supertypeOt = result.model.getObjectTypeByName("Person");
      expect(sf.subtypeId).toBe(subtypeOt!.id);
      expect(sf.supertypeId).toBe(supertypeOt!.id);
    });

    it("respects provides_identification = false", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Employee",
              supertype: "Person",
              provides_identification: false,
              description: "Employee is a Person with separate ID",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(1);
      expect(result.model.subtypeFacts[0]!.providesIdentification).toBe(false);
    });

    it("creates multi-level subtype hierarchy", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Employee",
              supertype: "Person",
              description: "Employee is a Person",
              source_references: [],
            },
            {
              subtype: "Manager",
              supertype: "Employee",
              description: "Manager is an Employee",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(2);
      expect(result.subtypeProvenance).toHaveLength(2);
      expect(result.subtypeProvenance.every((sp) => sp.applied)).toBe(true);
    });

    it("records provenance for applied subtypes", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Employee",
              supertype: "Person",
              description: "Employee is a Person",
              source_references: [{ lines: [5, 6], excerpt: "employee is a person" }],
            },
          ],
        },
        "Test",
      );

      expect(result.subtypeProvenance).toHaveLength(1);
      expect(result.subtypeProvenance[0]!.applied).toBe(true);
      expect(result.subtypeProvenance[0]!.subtype).toBe("Employee");
      expect(result.subtypeProvenance[0]!.supertype).toBe("Person");
      expect(result.subtypeProvenance[0]!.sourceReferences).toHaveLength(1);
    });

    it("skips subtype when subtype entity is not found", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "NonExistent",
              supertype: "Person",
              description: "Missing subtype",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(0);
      expect(result.subtypeProvenance[0]!.applied).toBe(false);
      expect(result.subtypeProvenance[0]!.skipReason).toContain("NonExistent");
      expect(result.subtypeProvenance[0]!.skipReason).toContain("not found");
    });

    it("skips subtype when supertype entity is not found", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Employee",
              supertype: "NonExistent",
              description: "Missing supertype",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(0);
      expect(result.subtypeProvenance[0]!.applied).toBe(false);
      expect(result.subtypeProvenance[0]!.skipReason).toContain("NonExistent");
    });

    it("skips subtype when subtype is a value type", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Rating",
              supertype: "Person",
              description: "Value type as subtype",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(0);
      expect(result.subtypeProvenance[0]!.applied).toBe(false);
      expect(result.subtypeProvenance[0]!.skipReason).toContain("value type");
    });

    it("skips subtype when supertype is a value type", () => {
      const resp = makeModelWithEntities();
      const result = parseDraftModel(
        {
          ...resp,
          subtypes: [
            {
              subtype: "Employee",
              supertype: "Rating",
              description: "Value type as supertype",
              source_references: [],
            },
          ],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(0);
      expect(result.subtypeProvenance[0]!.applied).toBe(false);
      expect(result.subtypeProvenance[0]!.skipReason).toContain("value type");
    });

    it("handles missing subtypes array gracefully", () => {
      const result = parseDraftModel(
        {
          object_types: [],
          fact_types: [],
          subtypes: [],
          inferred_constraints: [],
          ambiguities: [],
        },
        "Test",
      );

      expect(result.model.subtypeFacts).toHaveLength(0);
      expect(result.subtypeProvenance).toHaveLength(0);
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
