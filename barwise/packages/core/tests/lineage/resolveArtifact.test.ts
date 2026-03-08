/**
 * Tests for artifact resolution through lineage manifest.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeManifest } from "../../src/lineage/manifest.js";
import { findOrmModel, resolveArtifact } from "../../src/lineage/resolveArtifact.js";
import type { LineageManifest } from "../../src/lineage/types.js";

const testDir = join(import.meta.dirname!, "test-resolve-fixture");
const barwiseDir = join(testDir, ".barwise");
const artifactPath = join(testDir, "output", "schema.sql");

describe("resolveArtifact", () => {
  beforeEach(() => {
    // Create test directory structure.
    mkdirSync(join(testDir, "output"), { recursive: true });
    mkdirSync(barwiseDir, { recursive: true });

    // Write a dummy artifact file.
    writeFileSync(artifactPath, "CREATE TABLE test;", "utf-8");
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("resolves an artifact through the manifest", () => {
    const manifest: LineageManifest = {
      version: 1,
      sourceModel: "model.orm.yaml",
      sourceModelHash: "abc123",
      exports: [
        {
          artifact: resolve(artifactPath),
          format: "ddl",
          exportedAt: "2026-01-01T00:00:00.000Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: "e1",
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
      ],
    };
    writeManifest(testDir, manifest);

    const result = resolveArtifact(artifactPath);
    expect(result).toBeDefined();
    expect(result!.manifestDir).toBe(testDir);
    expect(result!.sourceModel).toBe("model.orm.yaml");
    expect(result!.exportEntry.format).toBe("ddl");
    expect(result!.sources).toHaveLength(1);
    expect(result!.sources[0]!.elementName).toBe("Customer");
  });

  it("returns undefined when no manifest exists", () => {
    const result = resolveArtifact(artifactPath);
    expect(result).toBeUndefined();
  });

  it("returns undefined when artifact is not in manifest", () => {
    const manifest: LineageManifest = {
      version: 1,
      sourceModel: "model.orm.yaml",
      sourceModelHash: "abc123",
      exports: [
        {
          artifact: "/some/other/path.sql",
          format: "ddl",
          exportedAt: "2026-01-01T00:00:00.000Z",
          modelHash: "abc123",
          sources: [],
        },
      ],
    };
    writeManifest(testDir, manifest);

    const result = resolveArtifact(artifactPath);
    expect(result).toBeUndefined();
  });
});

describe("findOrmModel", () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("finds an ORM model by manifest sourceModel path", () => {
    writeFileSync(join(testDir, "model.orm.yaml"), "name: Test", "utf-8");

    const result = findOrmModel(testDir, "model.orm.yaml");
    expect(result).toBe(join(testDir, "model.orm.yaml"));
  });

  it("falls back to scanning for .orm.yaml files", () => {
    writeFileSync(join(testDir, "example.orm.yaml"), "name: Test", "utf-8");

    const result = findOrmModel(testDir);
    expect(result).toBe(join(testDir, "example.orm.yaml"));
  });

  it("returns undefined when no model is found", () => {
    writeFileSync(join(testDir, "readme.txt"), "Not a model", "utf-8");

    const result = findOrmModel(testDir);
    expect(result).toBeUndefined();
  });
});
