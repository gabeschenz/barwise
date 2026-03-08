/**
 * Tests for the LLM extraction prompt builder.
 *
 * The extraction prompt instructs the LLM to extract ORM elements from
 * a stakeholder transcript. These tests verify:
 *   - buildSystemPrompt includes ORM concept explanations, source-reference
 *     instructions, and confidence-level guidance
 *   - buildUserMessage wraps the transcript with line numbers
 *   - buildResponseSchema produces a valid JSON Schema with required fields
 *   - parseExtractionResponse handles well-formed, sparse, and invalid input
 */
import { describe, expect, it } from "vitest";
import {
  buildResponseSchema,
  buildSystemPrompt,
  buildUserMessage,
  parseExtractionResponse,
} from "../src/ExtractionPrompt.js";

describe("ExtractionPrompt", () => {
  describe("buildSystemPrompt", () => {
    it("includes ORM concept explanations", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("Entity types");
      expect(prompt).toContain("Value types");
      expect(prompt).toContain("Fact types");
      expect(prompt).toContain("Constraints");
    });

    it("includes instructions for source references", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("source_references");
      expect(prompt).toContain("line numbers");
    });

    it("includes confidence level guidance", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("high");
      expect(prompt).toContain("medium");
      expect(prompt).toContain("low");
    });

    it("instructs about ambiguity detection", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("Ambiguities");
      expect(prompt).toContain("review pass");
    });

    it("includes all 8 ambiguity categories", () => {
      const prompt = buildSystemPrompt();
      const categories = [
        "Identification",
        "Cardinality",
        "Optionality",
        "Overloaded terms",
        "Temporal",
        "Granularity",
        "Derivation",
        "Constraint completeness",
      ];
      for (const category of categories) {
        expect(prompt).toContain(`**${category}**`);
      }
    });

    it("includes concrete examples for each ambiguity category", () => {
      const prompt = buildSystemPrompt();
      // Each category has an "Example:" with a concrete scenario
      const examplePatterns = [
        "is email also unique", // Identification
        "belong to multiple projects", // Cardinality
        "discount code", // Optionality
        "user login accounts", // Overloaded terms
        "history be tracked", // Temporal
        "street, city, state", // Granularity
        "derived from line item", // Derivation
        "could a flight be neither", // Constraint completeness
      ];
      for (const pattern of examplePatterns) {
        expect(prompt).toContain(pattern);
      }
    });

    it("includes subtype relationship explanation", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("Subtype");
      expect(prompt).toContain("specialization");
      expect(prompt).toContain("provides_identification");
    });

    it("includes data type guidance for value types", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("data_type");
      expect(prompt).toContain("text");
      expect(prompt).toContain("integer");
      expect(prompt).toContain("decimal");
    });

    it("includes is_preferred guidance for uniqueness constraints", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain("is_preferred");
      expect(prompt).toContain("reference-mode fact types");
    });
  });

  describe("buildUserMessage", () => {
    it("wraps transcript in tags with line numbers", () => {
      const msg = buildUserMessage("Hello\nWorld\nTest");
      expect(msg).toContain("<transcript>");
      expect(msg).toContain("</transcript>");
      expect(msg).toContain("1: Hello");
      expect(msg).toContain("2: World");
      expect(msg).toContain("3: Test");
    });

    it("handles single-line transcripts", () => {
      const msg = buildUserMessage("Just one line");
      expect(msg).toContain("1: Just one line");
    });
  });

  describe("buildResponseSchema", () => {
    it("returns a valid JSON Schema object", () => {
      const schema = buildResponseSchema();
      expect(schema.type).toBe("object");
      expect(schema.required).toContain("object_types");
      expect(schema.required).toContain("fact_types");
      expect(schema.required).toContain("subtypes");
      expect(schema.required).toContain("inferred_constraints");
      expect(schema.required).toContain("ambiguities");
    });

    it("defines object_types as an array", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props["object_types"]?.type).toBe("array");
    });

    it("defines subtypes as an array with required fields", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props["subtypes"]?.type).toBe("array");
      const items = props["subtypes"]?.items as Record<string, unknown>;
      const itemRequired = items.required as string[];
      expect(itemRequired).toContain("subtype");
      expect(itemRequired).toContain("supertype");
      expect(itemRequired).toContain("description");
      expect(itemRequired).toContain("source_references");
    });

    it("includes data_type in object_types schema", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const items = props["object_types"]?.items as Record<string, unknown>;
      const itemProps = items.properties as Record<string, Record<string, unknown>>;
      expect(itemProps["data_type"]).toBeDefined();
      const dtProps = itemProps["data_type"]?.properties as Record<string, Record<string, unknown>>;
      expect(dtProps["name"]?.enum).toContain("text");
      expect(dtProps["name"]?.enum).toContain("integer");
      expect(dtProps["name"]?.enum).toContain("decimal");
      expect(dtProps["length"]).toBeDefined();
      expect(dtProps["scale"]).toBeDefined();
    });

    it("includes is_preferred in inferred_constraints schema", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const constraintItems = props["inferred_constraints"] as Record<string, unknown>;
      const items = constraintItems.items as Record<string, unknown>;
      const itemProps = items.properties as Record<string, Record<string, unknown>>;
      expect(itemProps["is_preferred"]).toBeDefined();
      expect(itemProps["is_preferred"]?.type).toBe("boolean");
    });

    it("includes aliases in object_types schema", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const items = props["object_types"]?.items as Record<string, unknown>;
      const itemProps = items.properties as Record<string, Record<string, unknown>>;
      expect(itemProps["aliases"]).toBeDefined();
      expect(itemProps["aliases"]?.type).toBe("array");
      const aliasItems = itemProps["aliases"]?.items as Record<string, unknown>;
      expect(aliasItems.type).toBe("string");
    });

    it("defines objectified_fact_types as an array with required fields", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props["objectified_fact_types"]?.type).toBe("array");
      const items = props["objectified_fact_types"]?.items as Record<string, unknown>;
      const itemRequired = items.required as string[];
      expect(itemRequired).toContain("fact_type");
      expect(itemRequired).toContain("object_type");
      expect(itemRequired).toContain("description");
      expect(itemRequired).toContain("source_references");
    });

    it("defines constraint types enum", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      const constraintItems = props["inferred_constraints"] as Record<string, unknown>;
      const items = constraintItems.items as Record<string, unknown>;
      const itemProps = items.properties as Record<string, Record<string, unknown>>;
      const typeEnum = itemProps["type"]?.enum as string[];
      expect(typeEnum).toContain("internal_uniqueness");
      expect(typeEnum).toContain("mandatory");
      expect(typeEnum).toContain("value_constraint");
    });
  });

  describe("parseExtractionResponse", () => {
    it("parses a well-formed response", () => {
      const input = {
        object_types: [
          {
            name: "Customer",
            kind: "entity",
            source_references: [{ lines: [1, 2], excerpt: "test" }],
          },
        ],
        fact_types: [],
        inferred_constraints: [],
        ambiguities: [],
      };

      const result = parseExtractionResponse(input);
      expect(result.object_types).toHaveLength(1);
      expect(result.object_types[0]?.name).toBe("Customer");
    });

    it("defaults missing arrays to empty", () => {
      const result = parseExtractionResponse({});
      expect(result.object_types).toHaveLength(0);
      expect(result.fact_types).toHaveLength(0);
      expect(result.subtypes).toHaveLength(0);
      expect(result.inferred_constraints).toHaveLength(0);
      expect(result.ambiguities).toHaveLength(0);
    });

    it("throws for non-object input", () => {
      expect(() => parseExtractionResponse(null)).toThrow(
        "must be a JSON object",
      );
      expect(() => parseExtractionResponse("string")).toThrow(
        "must be a JSON object",
      );
    });
  });
});
