/**
 * Tests for the export command.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { runCli } from "../helpers/run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");
const tmpDir = resolve(__dirname, "../tmp-export");

describe("fregma export", () => {
  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  });

  describe("yaml", () => {
    it("re-serializes model to stdout", async () => {
      const result = await runCli([
        "export",
        "yaml",
        `${fixtures}/simple.orm.yaml`,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("orm_version");
      expect(result.stdout).toContain("Customer");
    });

    it("writes to file with --output", async () => {
      mkdirSync(tmpDir, { recursive: true });
      const outFile = join(tmpDir, "out.orm.yaml");
      const result = await runCli([
        "export",
        "yaml",
        `${fixtures}/simple.orm.yaml`,
        "--output",
        outFile,
      ]);
      expect(result.exitCode).toBe(0);
      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf-8");
      expect(content).toContain("Customer");
    });
  });

  describe("json", () => {
    it("serializes model as JSON", async () => {
      const result = await runCli([
        "export",
        "json",
        `${fixtures}/simple.orm.yaml`,
      ]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty("orm_version");
      expect(parsed).toHaveProperty("model");
    });
  });

  describe("dbt", () => {
    it("generates dbt files in output directory", async () => {
      const result = await runCli([
        "export",
        "dbt",
        `${fixtures}/simple.orm.yaml`,
        "--output-dir",
        tmpDir,
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("schema.yml");
      expect(existsSync(join(tmpDir, "schema.yml"))).toBe(true);
    });
  });

  describe("openapi", () => {
    it("generates OpenAPI JSON to stdout", async () => {
      const result = await runCli([
        "export",
        "openapi",
        `${fixtures}/simple.orm.yaml`,
      ]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.openapi).toBe("3.0.0");
      expect(parsed.components.schemas).toBeDefined();
      expect(parsed.paths).toBeDefined();
    });

    it("writes to file with --output", async () => {
      mkdirSync(tmpDir, { recursive: true });
      const outFile = join(tmpDir, "openapi.json");
      const result = await runCli([
        "export",
        "openapi",
        `${fixtures}/simple.orm.yaml`,
        "--output",
        outFile,
      ]);
      expect(result.exitCode).toBe(0);
      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.openapi).toBe("3.0.0");
    });

    it("applies custom title and api-version", async () => {
      const result = await runCli([
        "export",
        "openapi",
        `${fixtures}/simple.orm.yaml`,
        "--title",
        "My API",
        "--api-version",
        "2.0.0",
      ]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.info.title).toBe("My API");
      expect(parsed.info.version).toBe("2.0.0");
    });
  });
});
