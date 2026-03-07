/**
 * Tests for the merge_models tool.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeMerge } from "../../src/tools/merge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("merge_models tool", () => {
  it("returns unchanged for identical models", () => {
    const result = executeMerge(
      `${fixtures}/simple.orm.yaml`,
      `${fixtures}/simple.orm.yaml`,
    );
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.hasChanges).toBe(false);
    expect(parsed.valid).toBe(true);
  });

  it("merges additions from incoming model", () => {
    const result = executeMerge(
      `${fixtures}/simple.orm.yaml`,
      `${fixtures}/simple-modified.orm.yaml`,
    );
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.hasChanges).toBe(true);
    expect(parsed.yaml).toBeDefined();
    // The modified fixture adds Email, so it should appear in merged output.
    expect(parsed.yaml).toContain("Email");
  });

  it("includes structural diagnostics array", () => {
    const result = executeMerge(
      `${fixtures}/simple.orm.yaml`,
      `${fixtures}/simple-modified.orm.yaml`,
    );
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveProperty("diagnostics");
    expect(Array.isArray(parsed.diagnostics)).toBe(true);
    expect(parsed).toHaveProperty("errorCount");
  });

  it("returns content in MCP format", () => {
    const result = executeMerge(
      `${fixtures}/simple.orm.yaml`,
      `${fixtures}/simple.orm.yaml`,
    );
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
  });
});
