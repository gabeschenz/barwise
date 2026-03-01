/**
 * Tests for the generate_schema tool.
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { executeSchema } from "../../src/tools/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("generate_schema tool", () => {
  it("returns DDL by default", () => {
    const result = executeSchema(`${fixtures}/simple.orm.yaml`);
    expect(result.content[0]!.text).toContain("CREATE TABLE");
  });

  it("returns DDL when format is ddl", () => {
    const result = executeSchema(`${fixtures}/simple.orm.yaml`, "ddl");
    expect(result.content[0]!.text).toContain("CREATE TABLE");
  });

  it("returns JSON when format is json", () => {
    const result = executeSchema(`${fixtures}/simple.orm.yaml`, "json");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toHaveProperty("tables");
    expect(Array.isArray(parsed.tables)).toBe(true);
  });

  it("returns content in MCP format", () => {
    const result = executeSchema(`${fixtures}/simple.orm.yaml`);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
  });
});
