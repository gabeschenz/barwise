/**
 * Tests for the schema command.
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../helpers/run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("barwise schema", () => {
  it("generates DDL by default", async () => {
    const result = await runCli(["schema", `${fixtures}/simple.orm.yaml`]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CREATE TABLE");
  });

  it("generates JSON with --format json", async () => {
    const result = await runCli([
      "schema",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "json",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("tables");
    expect(Array.isArray(parsed.tables)).toBe(true);
    expect(parsed.tables.length).toBeGreaterThan(0);
    expect(parsed.tables[0]).toHaveProperty("name");
    expect(parsed.tables[0]).toHaveProperty("columns");
  });

  it("reports error for nonexistent file", async () => {
    const result = await runCli(["schema", `${fixtures}/nonexistent.orm.yaml`]);
    expect(result.stderr).toContain("File not found");
    expect(result.exitCode).toBe(1);
  });
});
