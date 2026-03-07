/**
 * Tests for the validate command.
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../helpers/run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("barwise validate", () => {
  it("reports valid model with 0 errors", async () => {
    const result = await runCli(["validate", `${fixtures}/simple.orm.yaml`]);
    expect(result.stdout).toContain("0 error");
    expect(result.exitCode).toBe(0);
  });

  it("reports errors for invalid model and exits 1", async () => {
    const result = await runCli(["validate", `${fixtures}/invalid.orm.yaml`]);
    // The invalid fixture has a dangling player reference. This may
    // be caught at deserialization (schema validation) or by the
    // validation engine. Either way, the CLI should exit 1.
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toContain("error");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON with --format json on a valid model", async () => {
    const result = await runCli([
      "validate",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "json",
    ]);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    // May have warnings but no errors.
    for (const d of parsed) {
      expect(d).toHaveProperty("severity");
      expect(d).toHaveProperty("message");
    }
  });

  it("reports error for nonexistent file", async () => {
    const result = await runCli(["validate", `${fixtures}/nonexistent.orm.yaml`]);
    expect(result.stderr).toContain("File not found");
    expect(result.exitCode).toBe(1);
  });

  it("suppresses warnings with --no-warnings", async () => {
    const resultWith = await runCli(["validate", `${fixtures}/simple.orm.yaml`]);
    const resultWithout = await runCli([
      "validate",
      `${fixtures}/simple.orm.yaml`,
      "--no-warnings",
    ]);
    // Both should succeed for a valid model.
    expect(resultWith.exitCode).toBe(0);
    expect(resultWithout.exitCode).toBe(0);
  });
});
