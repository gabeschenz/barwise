/**
 * Tests for objectified fact type serialization and deserialization.
 *
 * Verifies:
 *   - Serialization produces correct YAML structure
 *   - Deserialization reconstructs the model correctly
 *   - Round-trip preserves all fields
 *   - Schema validation accepts objectified fact types
 *   - Schema validation rejects invalid objectified fact types
 *   - Models without objectified fact types omit the key
 */
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { OrmYamlSerializer } from "../../src/serialization/OrmYamlSerializer.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("Objectified fact type serialization", () => {
  const serializer = new OrmYamlSerializer();

  function makeMarriageModel() {
    return new ModelBuilder("Marriage Domain")
      .withEntityType("Person", { referenceMode: "person_id" })
      .withEntityType("Marriage", { referenceMode: "marriage_id" })
      .withValueType("Date")
      .withBinaryFactType("Person marries Person", {
        role1: { player: "Person", name: "marries" },
        role2: { player: "Person", name: "is married to" },
        uniqueness: "spanning",
      })
      .withBinaryFactType("Marriage has Date", {
        role1: { player: "Marriage", name: "has" },
        role2: { player: "Date", name: "is of" },
        uniqueness: "role1",
      })
      .withObjectifiedFactType("Person marries Person", "Marriage")
      .build();
  }

  describe("serialize", () => {
    it("includes objectified_fact_types in YAML output", () => {
      const model = makeMarriageModel();
      const yaml = serializer.serialize(model);
      const doc = parse(yaml);

      expect(doc.model.objectified_fact_types).toBeDefined();
      expect(doc.model.objectified_fact_types).toHaveLength(1);

      const oft = doc.model.objectified_fact_types[0];
      expect(oft.id).toBeTruthy();
      expect(oft.fact_type).toBe(
        model.getFactTypeByName("Person marries Person")!.id,
      );
      expect(oft.object_type).toBe(
        model.getObjectTypeByName("Marriage")!.id,
      );
    });

    it("omits objectified_fact_types when none exist", () => {
      const model = new ModelBuilder("Simple")
        .withEntityType("Customer")
        .build();
      const yaml = serializer.serialize(model);
      const doc = parse(yaml);

      expect(doc.model.objectified_fact_types).toBeUndefined();
    });
  });

  describe("deserialize", () => {
    it("reconstructs objectified fact types from YAML", () => {
      const model = makeMarriageModel();
      const yaml = serializer.serialize(model);

      const restored = serializer.deserialize(yaml);
      expect(restored.objectifiedFactTypes).toHaveLength(1);

      const oft = restored.objectifiedFactTypes[0]!;
      expect(oft.factTypeId).toBe(
        restored.getFactTypeByName("Person marries Person")!.id,
      );
      expect(oft.objectTypeId).toBe(
        restored.getObjectTypeByName("Marriage")!.id,
      );
    });

    it("handles YAML with no objectified fact types", () => {
      const yaml = `
orm_version: "1.0"
model:
  name: Simple
  object_types:
    - id: ot1
      name: Customer
      kind: entity
      reference_mode: customer_id
`;
      const model = serializer.deserialize(yaml);
      expect(model.objectifiedFactTypes).toHaveLength(0);
    });

    it("rejects invalid objectified fact type (missing fact_type)", () => {
      const yaml = `
orm_version: "1.0"
model:
  name: Bad
  objectified_fact_types:
    - id: oft1
      object_type: ot1
`;
      expect(() => serializer.deserialize(yaml)).toThrow();
    });

    it("rejects invalid objectified fact type (missing object_type)", () => {
      const yaml = `
orm_version: "1.0"
model:
  name: Bad
  objectified_fact_types:
    - id: oft1
      fact_type: ft1
`;
      expect(() => serializer.deserialize(yaml)).toThrow();
    });
  });

  describe("round-trip", () => {
    it("preserves all objectified fact type data through round-trip", () => {
      const original = makeMarriageModel();
      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(yaml);

      expect(restored.objectifiedFactTypes).toHaveLength(
        original.objectifiedFactTypes.length,
      );

      const origOft = original.objectifiedFactTypes[0]!;
      const restoredOft = restored.objectifiedFactTypes[0]!;

      expect(restoredOft.id).toBe(origOft.id);
      expect(restoredOft.factTypeId).toBe(origOft.factTypeId);
      expect(restoredOft.objectTypeId).toBe(origOft.objectTypeId);
    });

    it("preserves objectified fact type alongside other model elements", () => {
      const original = makeMarriageModel();
      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(yaml);

      // Verify all model elements survived.
      expect(restored.objectTypes).toHaveLength(original.objectTypes.length);
      expect(restored.factTypes).toHaveLength(original.factTypes.length);
      expect(restored.objectifiedFactTypes).toHaveLength(
        original.objectifiedFactTypes.length,
      );

      // Verify the objectified entity can still be queried.
      const marriage = restored.getObjectTypeByName("Marriage")!;
      expect(marriage).toBeTruthy();
      const oft = restored.objectificationFor(marriage.id);
      expect(oft).toBeTruthy();
      expect(
        restored.getFactType(oft!.factTypeId)!.name,
      ).toBe("Person marries Person");
    });
  });
});
