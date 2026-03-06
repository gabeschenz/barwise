/**
 * Tests for the describe command.
 */
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../helpers/run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");

describe("fregma describe", () => {
  it("returns domain summary for valid model", async () => {
    const result = await runCli(["describe", `${fixtures}/simple.orm.yaml`]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Domain Model:");
    expect(result.stdout).toContain("Entities:");
    expect(result.stdout).toContain("Fact Types:");
  });

  it("returns focused output with --focus on entity", async () => {
    const result = await runCli([
      "describe",
      `${fixtures}/simple.orm.yaml`,
      "--focus",
      "Customer",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Entity: Customer");
    expect(result.stdout).toContain("Related Fact Types:");
  });

  it("returns JSON output with --json", async () => {
    const result = await runCli([
      "describe",
      `${fixtures}/simple.orm.yaml`,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("entityTypes");
    expect(parsed).toHaveProperty("factTypes");
    expect(parsed).toHaveProperty("constraints");
    expect(Array.isArray(parsed.entityTypes)).toBe(true);
    expect(Array.isArray(parsed.factTypes)).toBe(true);
    expect(Array.isArray(parsed.constraints)).toBe(true);
  });

  it("returns verbose output with --verbose", async () => {
    const result = await runCli([
      "describe",
      `${fixtures}/simple.orm.yaml`,
      "--verbose",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Entity Types:");
    expect(result.stdout).toContain("Fact Types:");
    expect(result.stdout).toContain("Constraints:");
  });

  it("reports error for nonexistent file", async () => {
    const result = await runCli([
      "describe",
      `${fixtures}/nonexistent.orm.yaml`,
    ]);
    expect(result.stderr).toContain("File not found");
    expect(result.exitCode).toBe(1);
  });

  it("handles focus on constraint type", async () => {
    const result = await runCli([
      "describe",
      `${fixtures}/simple.orm.yaml`,
      "--focus",
      "mandatory",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Constraint Type:");
  });
});
