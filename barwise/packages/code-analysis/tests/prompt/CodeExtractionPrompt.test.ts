/**
 * Tests for the CodeExtractionPrompt.
 *
 * Verifies that the prompt builder creates well-structured system and
 * user messages from a CodeContext.
 */
import { describe, expect, it } from "vitest";
import { buildCodeExtractionPrompt } from "../../src/prompt/CodeExtractionPrompt.js";
import type { CodeContext } from "../../src/types.js";

function emptyContext(overrides?: Partial<CodeContext>): CodeContext {
  return {
    root: "/test",
    language: "java",
    types: [],
    validations: [],
    stateTransitions: [],
    annotations: [],
    filesAnalyzed: [],
    ...overrides,
  };
}

describe("buildCodeExtractionPrompt", () => {
  it("returns system and user messages", () => {
    const ctx = emptyContext();
    const { system, user } = buildCodeExtractionPrompt(ctx, "Test Model");

    expect(system).toBeDefined();
    expect(user).toBeDefined();
    expect(typeof system).toBe("string");
    expect(typeof user).toBe("string");
  });

  it("system prompt mentions ORM 2", () => {
    const ctx = emptyContext();
    const { system } = buildCodeExtractionPrompt(ctx, "Test");

    expect(system).toContain("ORM");
    expect(system).toContain("entity");
  });

  it("system prompt includes confidence levels", () => {
    const ctx = emptyContext();
    const { system } = buildCodeExtractionPrompt(ctx, "Test");

    expect(system).toContain("HIGH");
    expect(system).toContain("MEDIUM");
    expect(system).toContain("LOW");
  });

  it("user message includes model name", () => {
    const ctx = emptyContext();
    const { user } = buildCodeExtractionPrompt(ctx, "My Domain Model");

    expect(user).toContain("My Domain Model");
  });

  it("user message includes language", () => {
    const ctx = emptyContext({ language: "kotlin" });
    const { user } = buildCodeExtractionPrompt(ctx, "Test");

    expect(user).toContain("kotlin");
  });

  it("user message includes type definitions", () => {
    const ctx = emptyContext({
      types: [
        {
          name: "Customer",
          kind: "class",
          members: ["id", "name"],
          filePath: "Customer.java",
          startLine: 1,
          sourceText: "public class Customer { ... }",
        },
      ],
    });
    const { user } = buildCodeExtractionPrompt(ctx, "Test");

    expect(user).toContain("Type Definitions");
    expect(user).toContain("Customer");
    expect(user).toContain("Customer.java");
  });

  it("user message includes annotations", () => {
    const ctx = emptyContext({
      annotations: [
        {
          targetName: "name",
          targetKind: "field",
          className: "Product",
          annotation: "NotNull",
          parameters: {},
          filePath: "Product.java",
          line: 5,
          sourceText: "@NotNull",
        },
      ],
    });
    const { user } = buildCodeExtractionPrompt(ctx, "Test");

    expect(user).toContain("Annotations");
    expect(user).toContain("@NotNull");
    expect(user).toContain("Product");
  });

  it("user message includes validations", () => {
    const ctx = emptyContext({
      validations: [
        {
          functionName: "validateEmail",
          filePath: "Validator.java",
          startLine: 10,
          sourceText: "void validateEmail(String email) { ... }",
          targetType: "User",
        },
      ],
    });
    const { user } = buildCodeExtractionPrompt(ctx, "Test");

    expect(user).toContain("Validation Functions");
    expect(user).toContain("validateEmail");
  });

  it("user message includes state transitions", () => {
    const ctx = emptyContext({
      stateTransitions: [
        {
          stateField: "orderStatus",
          filePath: "OrderService.java",
          startLine: 20,
          sourceText: "switch (orderStatus) { ... }",
          transitions: [
            { from: "DRAFT", to: "SUBMITTED" },
          ],
        },
      ],
    });
    const { user } = buildCodeExtractionPrompt(ctx, "Test");

    expect(user).toContain("State Transitions");
    expect(user).toContain("orderStatus");
    expect(user).toContain("DRAFT");
    expect(user).toContain("SUBMITTED");
  });

  it("user message includes file count", () => {
    const ctx = emptyContext({
      filesAnalyzed: ["A.java", "B.java", "C.java"],
    });
    const { user } = buildCodeExtractionPrompt(ctx, "Test");

    expect(user).toContain("3");
  });
});
