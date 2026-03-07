/**
 * Tests for the generate_diagram tool.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeDiagram } from "../../src/tools/diagram.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("generate_diagram tool", () => {
  it("returns SVG content", async () => {
    const result = await executeDiagram(`${fixtures}/simple.orm.yaml`);
    expect(result.content[0]!.text).toContain("<svg");
  });

  it("includes model elements in SVG", async () => {
    const result = await executeDiagram(`${fixtures}/simple.orm.yaml`);
    expect(result.content[0]!.text).toContain("Customer");
  });

  it("returns content in MCP format", async () => {
    const result = await executeDiagram(`${fixtures}/simple.orm.yaml`);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
  });
});
