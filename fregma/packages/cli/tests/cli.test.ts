/**
 * Tests for the CLI scaffolding: program creation, version, help.
 */
import { describe, it, expect } from "vitest";
import { runCli } from "./helpers/run.js";

describe("CLI scaffolding", () => {
  it("shows version with --version", async () => {
    const result = await runCli(["--version"]);
    expect(result.stdout).toContain("0.1.0");
  });

  it("shows help with --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.stdout).toContain("ORM 2");
    expect(result.stdout).toContain("validate");
    expect(result.stdout).toContain("verbalize");
    expect(result.stdout).toContain("schema");
    expect(result.stdout).toContain("diagram");
    expect(result.stdout).toContain("diff");
    expect(result.stdout).toContain("export");
    expect(result.stdout).toContain("import");
  });
});
