/**
 * Tests for the BuildSystemDetector.
 *
 * Uses temporary directories with controlled build files to verify
 * detection and priority ordering.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildFileContains, detectBuildSystem } from "../../src/repo/BuildSystemDetector.js";

describe("BuildSystemDetector", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `barwise-build-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("detectBuildSystem", () => {
    it("returns null for empty directory", () => {
      expect(detectBuildSystem(testDir)).toBeNull();
    });

    it("detects package.json as npm", () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("npm");
      expect(result!.buildFile).toBe(join(testDir, "package.json"));
    });

    it("detects build.gradle.kts as Gradle (Kotlin)", () => {
      writeFileSync(
        join(testDir, "build.gradle.kts"),
        'plugins { kotlin("jvm") }',
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Gradle (Kotlin)");
    });

    it("detects build.gradle as Gradle (Groovy)", () => {
      writeFileSync(
        join(testDir, "build.gradle"),
        "apply plugin: 'java'",
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Gradle (Groovy)");
    });

    it("detects pom.xml as Maven", () => {
      writeFileSync(
        join(testDir, "pom.xml"),
        "<project><modelVersion>4.0.0</modelVersion></project>",
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Maven");
    });

    it("detects pyproject.toml", () => {
      writeFileSync(
        join(testDir, "pyproject.toml"),
        '[project]\nname = "test"',
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("pyproject");
    });

    it("detects go.mod as Go modules", () => {
      writeFileSync(
        join(testDir, "go.mod"),
        "module example.com/test\ngo 1.21",
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Go modules");
    });

    it("prefers higher-priority build system when multiple present", () => {
      // Gradle (Kotlin) has priority 10, npm has priority 7
      writeFileSync(
        join(testDir, "build.gradle.kts"),
        'plugins { kotlin("jvm") }',
      );
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      const result = detectBuildSystem(testDir);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Gradle (Kotlin)");
    });

    it("prefers Maven over npm", () => {
      writeFileSync(
        join(testDir, "pom.xml"),
        "<project/>",
      );
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({ name: "test" }),
      );
      const result = detectBuildSystem(testDir);
      expect(result!.name).toBe("Maven");
    });
  });

  describe("buildFileContains", () => {
    it("finds dependency in package.json", () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          dependencies: { express: "^4.18.0", "@nestjs/core": "^10.0.0" },
        }),
      );
      const result = buildFileContains(testDir, "@nestjs/core");
      expect(result.found).toBe(true);
      expect(result.buildFile).toBe(join(testDir, "package.json"));
    });

    it("finds dependency in build.gradle.kts", () => {
      writeFileSync(
        join(testDir, "build.gradle.kts"),
        `dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
}`,
      );
      const result = buildFileContains(testDir, "spring-boot");
      expect(result.found).toBe(true);
      expect(result.buildFile).toBe(join(testDir, "build.gradle.kts"));
    });

    it("finds dependency in pom.xml", () => {
      writeFileSync(
        join(testDir, "pom.xml"),
        `<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>`,
      );
      const result = buildFileContains(testDir, "spring-boot");
      expect(result.found).toBe(true);
    });

    it("returns not found when dependency absent", () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({ dependencies: { express: "^4.0.0" } }),
      );
      const result = buildFileContains(testDir, "@nestjs/core");
      expect(result.found).toBe(false);
      expect(result.buildFile).toBeNull();
    });

    it("returns not found for empty directory", () => {
      const result = buildFileContains(testDir, "anything");
      expect(result.found).toBe(false);
      expect(result.buildFile).toBeNull();
    });
  });
});
