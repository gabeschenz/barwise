/**
 * Tests for the diagram command.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { runCli } from "../helpers/run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../fixtures");
const tmpDir = resolve(__dirname, "../tmp-diagram");

describe("barwise diagram", () => {
  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("generates SVG to stdout", async () => {
    const result = await runCli(["diagram", `${fixtures}/simple.orm.yaml`]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("<svg");
  });

  it("writes SVG to file with --output", async () => {
    mkdirSync(tmpDir, { recursive: true });
    const outFile = join(tmpDir, "diagram.svg");
    const result = await runCli([
      "diagram",
      `${fixtures}/simple.orm.yaml`,
      "--output",
      outFile,
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    const content = readFileSync(outFile, "utf-8");
    expect(content).toContain("<svg");
  });
});
