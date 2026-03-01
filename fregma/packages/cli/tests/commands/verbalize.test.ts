/**
 * Tests for the verbalize command.
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../helpers/run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("fregma verbalize", () => {
  it("generates verbalizations for a model", async () => {
    const result = await runCli(["verbalize", `${fixtures}/simple.orm.yaml`]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Customer");
    expect(result.stdout).toContain("Name");
  });

  it("outputs JSON with --format json", async () => {
    const result = await runCli([
      "verbalize",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "json",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toHaveProperty("category");
    expect(parsed[0]).toHaveProperty("text");
  });

  it("filters by fact type with --fact-type", async () => {
    const result = await runCli([
      "verbalize",
      `${fixtures}/simple.orm.yaml`,
      "--fact-type",
      "Customer has Name",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Customer");
  });

  it("reports error for nonexistent fact type", async () => {
    const result = await runCli([
      "verbalize",
      `${fixtures}/simple.orm.yaml`,
      "--fact-type",
      "Nonexistent Fact",
    ]);
    expect(result.stderr).toContain("not found");
    expect(result.exitCode).toBe(1);
  });
});
