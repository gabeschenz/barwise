/**
 * Tests for the dbt dialect detector.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectDbtDialect } from "../../src/import/DbtDialectDetector.js";

let testDir: string;

function createTestDir(): string {
  const dir = join(tmpdir(), `barwise-dialect-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("detectDbtDialect", () => {
  beforeEach(() => {
    testDir = createTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns explicit dialect when provided", () => {
    expect(detectDbtDialect(testDir, "snowflake")).toBe("snowflake");
  });

  it("returns explicit dialect over all other detection methods", () => {
    // Write a profiles.yml that says postgres
    writeFileSync(
      join(testDir, "profiles.yml"),
      "default:\n  target: dev\n  outputs:\n    dev:\n      type: postgres\n",
    );
    writeFileSync(
      join(testDir, "dbt_project.yml"),
      "name: test\nprofile: default\n",
    );

    // Explicit overrides profiles
    expect(detectDbtDialect(testDir, "bigquery")).toBe("bigquery");
  });

  it("detects dialect from profiles.yml in project directory", () => {
    writeFileSync(
      join(testDir, "profiles.yml"),
      "default:\n  target: dev\n  outputs:\n    dev:\n      type: snowflake\n",
    );
    writeFileSync(
      join(testDir, "dbt_project.yml"),
      "name: test\nprofile: default\n",
    );

    expect(detectDbtDialect(testDir)).toBe("snowflake");
  });

  it("detects dialect from requirements.txt", () => {
    writeFileSync(join(testDir, "requirements.txt"), "dbt-bigquery==1.7.0\n");

    expect(detectDbtDialect(testDir)).toBe("bigquery");
  });

  it("falls back to ansi when nothing is detected", () => {
    expect(detectDbtDialect(testDir)).toBe("ansi");
  });

  it("handles missing dbt_project.yml gracefully", () => {
    // No files at all
    expect(detectDbtDialect(testDir)).toBe("ansi");
  });
});
