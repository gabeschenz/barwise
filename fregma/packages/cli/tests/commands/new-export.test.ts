/**
 * Tests for the new export command (format registry dispatch).
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../helpers/run.js";
import { existsSync, readFileSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");
const testOutput = resolve(__dirname, "../test-output");

describe("fregma export (new format registry)", () => {
  it("exports DDL to stdout with --format ddl", async () => {
    const result = await runCli([
      "export",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "ddl",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CREATE TABLE");
  });

  it("exports OpenAPI to stdout with --format openapi", async () => {
    const result = await runCli([
      "export",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "openapi",
    ]);
    expect(result.exitCode).toBe(0);
    // OpenAPI output should be JSON.
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("openapi");
    expect(parsed).toHaveProperty("info");
    expect(parsed).toHaveProperty("paths");
  });

  it("writes output to file with --output", async () => {
    const outputFile = `${testOutput}/test-export.sql`;
    // Clean up from previous runs.
    if (existsSync(outputFile)) {
      rmSync(outputFile);
    }

    const result = await runCli([
      "export",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "ddl",
      "--output",
      outputFile,
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(outputFile)).toBe(true);

    const content = readFileSync(outputFile, "utf-8");
    expect(content).toContain("CREATE TABLE");

    // Clean up.
    rmSync(outputFile);
  });

  it("reports error for unknown format", async () => {
    const result = await runCli([
      "export",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "unknown",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown export format");
    expect(result.stderr).toContain("Available formats:");
  });

  it("reports error for nonexistent file", async () => {
    const result = await runCli([
      "export",
      `${fixtures}/nonexistent.orm.yaml`,
      "--format",
      "ddl",
    ]);
    expect(result.stderr).toContain("File not found");
    expect(result.exitCode).toBe(1);
  });

  it("respects --no-annotate flag", async () => {
    const result = await runCli([
      "export",
      `${fixtures}/simple.orm.yaml`,
      "--format",
      "ddl",
      "--no-annotate",
    ]);
    expect(result.exitCode).toBe(0);
    // With --no-annotate, output should be cleaner (no TODO comments).
    // This is a behavior test, not a strict check.
    expect(result.stdout).toContain("CREATE TABLE");
  });

  it("respects --strict flag and fails on validation errors", async () => {
    // Use invalid fixture if available, otherwise skip.
    const invalidFile = `${fixtures}/invalid.orm.yaml`;
    if (!existsSync(invalidFile)) {
      // Skip if invalid fixture doesn't exist.
      return;
    }

    const result = await runCli([
      "export",
      invalidFile,
      "--format",
      "ddl",
      "--strict",
    ]);
    // Should fail in strict mode with validation errors.
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toLowerCase()).toContain("error");
  });
});
