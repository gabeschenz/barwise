/**
 * Tests for the LanguageDetector.
 *
 * Uses temporary directories with controlled file structures to verify
 * language detection by file extension counting.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { countLanguages, detectLanguage } from "../../src/repo/LanguageDetector.js";

describe("LanguageDetector", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `barwise-lang-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  /** Helper: create a file with empty content. */
  function touch(relativePath: string): void {
    const fullPath = join(testDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, "// placeholder");
  }

  describe("detectLanguage", () => {
    it("returns 'unknown' for empty directory", () => {
      expect(detectLanguage(testDir)).toBe("unknown");
    });

    it("detects TypeScript when .ts files dominate", () => {
      touch("src/index.ts");
      touch("src/app.ts");
      touch("src/utils.ts");
      expect(detectLanguage(testDir)).toBe("typescript");
    });

    it("detects Java when .java files dominate", () => {
      touch("src/main/java/App.java");
      touch("src/main/java/Service.java");
      touch("src/main/java/Model.java");
      expect(detectLanguage(testDir)).toBe("java");
    });

    it("detects Kotlin when .kt files dominate", () => {
      touch("src/main/kotlin/App.kt");
      touch("src/main/kotlin/Service.kt");
      expect(detectLanguage(testDir)).toBe("kotlin");
    });

    it("detects Python when .py files dominate", () => {
      touch("app/main.py");
      touch("app/models.py");
      touch("app/views.py");
      expect(detectLanguage(testDir)).toBe("python");
    });

    it("groups .js and .jsx with TypeScript", () => {
      touch("src/index.js");
      touch("src/App.jsx");
      touch("src/utils.js");
      expect(detectLanguage(testDir)).toBe("typescript");
    });

    it("returns the language with most files in mixed repos", () => {
      // 3 Java files vs 1 TypeScript
      touch("src/main/java/App.java");
      touch("src/main/java/Service.java");
      touch("src/main/java/Model.java");
      touch("frontend/index.ts");
      expect(detectLanguage(testDir)).toBe("java");
    });

    it("skips node_modules", () => {
      touch("src/index.ts");
      // Many JS files in node_modules should be ignored
      touch("node_modules/lib/a.js");
      touch("node_modules/lib/b.js");
      touch("node_modules/lib/c.js");
      touch("node_modules/lib/d.js");
      // Only 1 TS file should be the winner
      expect(detectLanguage(testDir)).toBe("typescript");
    });

    it("skips .git directory", () => {
      touch("src/main.py");
      touch(".git/hooks/pre-commit.js");
      touch(".git/hooks/post-commit.js");
      expect(detectLanguage(testDir)).toBe("python");
    });

    it("skips dist and build directories", () => {
      touch("src/index.ts");
      touch("dist/index.js");
      touch("dist/bundle.js");
      touch("dist/vendor.js");
      touch("build/output.js");
      // Without skipping, JS files would outnumber TS
      // But JS maps to typescript anyway. Let's use a different scenario:
      // The point is these dirs are skipped entirely
      const counts = countLanguages(testDir);
      // Should only count src/index.ts (1 file), not dist or build
      expect(counts).toHaveLength(1);
      const total = counts.reduce((sum, c) => sum + c.count, 0);
      expect(total).toBe(1);
    });
  });

  describe("countLanguages", () => {
    it("returns empty array for empty directory", () => {
      expect(countLanguages(testDir)).toEqual([]);
    });

    it("counts files by language, sorted by count descending", () => {
      // 3 Java, 2 TypeScript, 1 Python
      touch("src/A.java");
      touch("src/B.java");
      touch("src/C.java");
      touch("src/index.ts");
      touch("src/app.ts");
      touch("scripts/run.py");

      const counts = countLanguages(testDir);
      expect(counts.length).toBeGreaterThanOrEqual(3);
      expect(counts[0]!.language).toBe("java");
      expect(counts[0]!.count).toBe(3);
      expect(counts[1]!.language).toBe("typescript");
      expect(counts[1]!.count).toBe(2);
      expect(counts[2]!.language).toBe("python");
      expect(counts[2]!.count).toBe(1);
    });

    it("ignores non-source files", () => {
      touch("README.md");
      touch("config.json");
      touch("data.csv");
      touch("image.png");
      expect(countLanguages(testDir)).toEqual([]);
    });
  });
});
