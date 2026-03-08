/**
 * Unit tests for the chat participant prompts and configuration.
 *
 * The handler itself requires the VS Code runtime (vscode.chat,
 * vscode.lm, etc.), so it is covered by integration tests. These
 * unit tests verify the exported constants and configuration that
 * drive the participant's behavior. The constants live in
 * chatPrompts.ts (no VS Code dependency) so they can be tested here.
 */
import { describe, expect, it } from "vitest";
import {
  COMMAND_INSTRUCTIONS,
  FOLLOWUP_SUGGESTIONS,
  SYSTEM_PROMPT,
} from "../../src/chat/chatPrompts.js";

describe("ChatParticipant", () => {
  describe("SYSTEM_PROMPT", () => {
    it("identifies as an ORM 2 domain expert", () => {
      expect(SYSTEM_PROMPT).toContain("ORM 2");
      expect(SYSTEM_PROMPT).toContain("Barwise");
    });

    it("lists all available tool names", () => {
      const expectedTools = [
        "barwise_import_transcript",
        "barwise_validate_model",
        "barwise_verbalize_model",
        "barwise_generate_schema",
        "barwise_generate_diagram",
        "barwise_diff_models",
        "barwise_merge_models",
      ];
      for (const tool of expectedTools) {
        expect(SYSTEM_PROMPT).toContain(tool);
      }
    });

    it("mentions key ORM concepts", () => {
      const concepts = [
        "entity types",
        "value types",
        "fact types",
        "constraints",
        ".orm.yaml",
      ];
      for (const concept of concepts) {
        expect(SYSTEM_PROMPT).toContain(concept);
      }
    });
  });

  describe("COMMAND_INSTRUCTIONS", () => {
    it("has instructions for all 5 slash commands", () => {
      const expectedCommands = [
        "import",
        "validate",
        "verbalize",
        "diagram",
        "schema",
      ];
      for (const cmd of expectedCommands) {
        expect(COMMAND_INSTRUCTIONS).toHaveProperty(cmd);
        expect(COMMAND_INSTRUCTIONS[cmd]!.length).toBeGreaterThan(0);
      }
    });

    it("import instruction references the import tool", () => {
      expect(COMMAND_INSTRUCTIONS.import).toContain(
        "barwise_import_transcript",
      );
    });

    it("validate instruction references the validate tool", () => {
      expect(COMMAND_INSTRUCTIONS.validate).toContain(
        "barwise_validate_model",
      );
    });

    it("verbalize instruction references the verbalize tool", () => {
      expect(COMMAND_INSTRUCTIONS.verbalize).toContain(
        "barwise_verbalize_model",
      );
    });

    it("diagram instruction references the diagram tool", () => {
      expect(COMMAND_INSTRUCTIONS.diagram).toContain(
        "barwise_generate_diagram",
      );
    });

    it("schema instruction references the schema tool", () => {
      expect(COMMAND_INSTRUCTIONS.schema).toContain(
        "barwise_generate_schema",
      );
    });
  });

  describe("FOLLOWUP_SUGGESTIONS", () => {
    it("suggests validate, diagram, verbalize, and schema", () => {
      const commands = FOLLOWUP_SUGGESTIONS.map((s) => s.command);
      expect(commands).toContain("validate");
      expect(commands).toContain("diagram");
      expect(commands).toContain("verbalize");
      expect(commands).toContain("schema");
    });

    it("each suggestion has a non-empty prompt", () => {
      for (const suggestion of FOLLOWUP_SUGGESTIONS) {
        expect(suggestion.prompt.length).toBeGreaterThan(0);
      }
    });
  });
});
