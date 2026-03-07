/**
 * Tests for the verbalize_model tool.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeVerbalize } from "../../src/tools/verbalize.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("verbalize_model tool", () => {
  it("returns verbalizations for a model file", () => {
    const result = executeVerbalize(`${fixtures}/simple.orm.yaml`);
    expect(result.content[0]!.text).toContain("Customer");
    expect(result.content[0]!.text).toContain("Name");
  });

  it("filters by fact type name", () => {
    const result = executeVerbalize(
      `${fixtures}/simple.orm.yaml`,
      "Customer has Name",
    );
    expect(result.content[0]!.text).toContain("Customer");
  });

  it("returns message for nonexistent fact type", () => {
    const result = executeVerbalize(
      `${fixtures}/simple.orm.yaml`,
      "Nonexistent Fact Type",
    );
    expect(result.content[0]!.text).toContain("No fact type found");
  });

  it("returns content in MCP format", () => {
    const result = executeVerbalize(`${fixtures}/simple.orm.yaml`);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
  });
});
