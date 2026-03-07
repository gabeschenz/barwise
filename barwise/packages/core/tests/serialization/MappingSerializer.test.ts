/**
 * Tests for MappingSerializer (.map.yaml file format).
 *
 * Context mappings record how object types in one bounded context relate
 * to object types in another. The serializer handles entity mappings,
 * semantic conflicts, and integration-pattern metadata. These tests
 * verify serialization, deserialization, round-trip fidelity, and
 * error handling for invalid YAML and schema violations.
 */
import { describe, it, expect } from "vitest";
import {
  MappingSerializer,
  MappingDeserializationError,
} from "../../src/serialization/MappingSerializer.js";
import { ContextMapping } from "../../src/model/ContextMapping.js";

describe("MappingSerializer", () => {
  const serializer = new MappingSerializer();

  describe("serialize", () => {
    it("serializes a minimal mapping", () => {
      const mapping = new ContextMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
      });

      const yaml = serializer.serialize(mapping);
      expect(yaml).toContain("mapping:");
      expect(yaml).toContain("source_context: crm");
      expect(yaml).toContain("target_context: billing");
      expect(yaml).toContain("pattern: shared_kernel");
    });

    it("serializes entity mappings", () => {
      const mapping = new ContextMapping({
        path: "./test.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "anticorruption_layer",
        entityMappings: [
          {
            sourceObjectType: "Customer",
            targetObjectType: "Account",
            description: "CRM customer is billing account.",
          },
        ],
      });

      const yaml = serializer.serialize(mapping);
      expect(yaml).toContain("entity_mappings:");
      expect(yaml).toContain("source_object_type: Customer");
      expect(yaml).toContain("target_object_type: Account");
    });

    it("serializes semantic conflicts", () => {
      const mapping = new ContextMapping({
        path: "./test.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "anticorruption_layer",
        semanticConflicts: [
          {
            term: "Customer",
            sourceMeaning: "A lead or prospect.",
            targetMeaning: "A paying entity.",
            resolution: "Use CRM definition.",
          },
        ],
      });

      const yaml = serializer.serialize(mapping);
      expect(yaml).toContain("semantic_conflicts:");
      expect(yaml).toContain("term: Customer");
    });
  });

  describe("deserialize", () => {
    it("deserializes a minimal mapping", () => {
      const yaml = `
mapping:
  source_context: "crm"
  target_context: "billing"
  pattern: "shared_kernel"
`;
      const mapping = serializer.deserialize(yaml, "./test.map.yaml");
      expect(mapping.sourceContext).toBe("crm");
      expect(mapping.targetContext).toBe("billing");
      expect(mapping.pattern).toBe("shared_kernel");
      expect(mapping.path).toBe("./test.map.yaml");
    });

    it("deserializes entity mappings", () => {
      const yaml = `
mapping:
  source_context: "crm"
  target_context: "billing"
  pattern: "anticorruption_layer"
  entity_mappings:
    - source_object_type: "Customer"
      target_object_type: "Account"
      description: "CRM customer is billing account."
`;
      const mapping = serializer.deserialize(yaml, "./test.map.yaml");
      expect(mapping.entityMappings).toHaveLength(1);
      expect(mapping.entityMappings[0]!.sourceObjectType).toBe(
        "Customer",
      );
      expect(mapping.entityMappings[0]!.description).toBe(
        "CRM customer is billing account.",
      );
    });

    it("deserializes semantic conflicts", () => {
      const yaml = `
mapping:
  source_context: "crm"
  target_context: "billing"
  pattern: "anticorruption_layer"
  semantic_conflicts:
    - term: "Customer"
      source_meaning: "A lead."
      target_meaning: "A payer."
      resolution: "Use CRM definition."
`;
      const mapping = serializer.deserialize(yaml, "./test.map.yaml");
      expect(mapping.semanticConflicts).toHaveLength(1);
      expect(mapping.semanticConflicts[0]!.term).toBe("Customer");
      expect(mapping.semanticConflicts[0]!.resolution).toBe(
        "Use CRM definition.",
      );
    });

    it("throws on invalid YAML", () => {
      expect(() =>
        serializer.deserialize("{{{{", "./test.map.yaml"),
      ).toThrow(MappingDeserializationError);
    });

    it("throws on schema validation failure", () => {
      expect(() =>
        serializer.deserialize("foo: bar", "./test.map.yaml"),
      ).toThrow(MappingDeserializationError);
    });

    it("throws when required fields are missing", () => {
      const yaml = `
mapping:
  source_context: "crm"
`;
      expect(() =>
        serializer.deserialize(yaml, "./test.map.yaml"),
      ).toThrow(MappingDeserializationError);
    });
  });

  describe("round-trip", () => {
    it("round-trips a full mapping", () => {
      const original = new ContextMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "anticorruption_layer",
        entityMappings: [
          {
            sourceObjectType: "Customer",
            targetObjectType: "Account",
            description: "CRM customer is billing account.",
          },
        ],
        semanticConflicts: [
          {
            term: "Order",
            sourceMeaning: "A purchase request.",
            targetMeaning: "An invoice.",
            resolution: "Map CRM Order to Billing Invoice.",
          },
        ],
      });

      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(
        yaml,
        "./crm-billing.map.yaml",
      );

      expect(restored.sourceContext).toBe("crm");
      expect(restored.targetContext).toBe("billing");
      expect(restored.pattern).toBe("anticorruption_layer");
      expect(restored.entityMappings).toHaveLength(1);
      expect(restored.entityMappings[0]!.sourceObjectType).toBe(
        "Customer",
      );
      expect(restored.semanticConflicts).toHaveLength(1);
      expect(restored.semanticConflicts[0]!.term).toBe("Order");
    });
  });
});
