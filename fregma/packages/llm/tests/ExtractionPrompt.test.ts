import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildUserMessage,
  buildResponseSchema,
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
      expect(prompt).toContain("contradictions");
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
      expect(schema.required).toContain("inferred_constraints");
      expect(schema.required).toContain("ambiguities");
    });

    it("defines object_types as an array", () => {
      const schema = buildResponseSchema();
      const props = schema.properties as Record<string, Record<string, unknown>>;
      expect(props["object_types"]?.type).toBe("array");
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
