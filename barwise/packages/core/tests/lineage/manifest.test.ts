import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  writeManifest,
  readManifest,
  updateManifest,
  hashModel,
} from "../../src/lineage/manifest.js";
import type { LineageManifest, ManifestExport } from "../../src/lineage/types.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("Lineage Manifest", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "barwise-lineage-test-"));
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("writeManifest", () => {
    it("should create .barwise/lineage.yaml in the specified directory", () => {
      const manifest: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: "abc123",
        exports: [],
      };

      writeManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, ".barwise", "lineage.yaml");
      expect(fs.existsSync(manifestPath)).toBe(true);
    });

    it("should write manifest content correctly", () => {
      const manifest: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: "abc123",
        exports: [
          {
            artifact: "schema.sql",
            format: "ddl",
            exportedAt: "2026-03-06T12:00:00Z",
            modelHash: "abc123",
            sources: [
              {
                elementId: "entity-1",
                elementType: "EntityType",
                elementName: "Customer",
              },
            ],
          },
        ],
      };

      writeManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, ".barwise", "lineage.yaml");
      const content = fs.readFileSync(manifestPath, "utf-8");
      expect(content).toContain("version: 1");
      expect(content).toContain("sourceModel: test.orm.yaml");
      expect(content).toContain("sourceModelHash: abc123");
      expect(content).toContain("artifact: schema.sql");
    });
  });

  describe("readManifest", () => {
    it("should read back what was written (round-trip)", () => {
      const original: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: "abc123",
        exports: [
          {
            artifact: "schema.sql",
            format: "ddl",
            exportedAt: "2026-03-06T12:00:00Z",
            modelHash: "abc123",
            sources: [
              {
                elementId: "entity-1",
                elementType: "EntityType",
                elementName: "Customer",
              },
            ],
          },
        ],
      };

      writeManifest(tempDir, original);
      const readBack = readManifest(tempDir);

      expect(readBack).toEqual(original);
    });

    it("should return undefined for nonexistent manifest", () => {
      const result = readManifest(tempDir);
      expect(result).toBeUndefined();
    });

    it("should return undefined when .barwise directory does not exist", () => {
      const nonExistentDir = path.join(tempDir, "does-not-exist");
      const result = readManifest(nonExistentDir);
      expect(result).toBeUndefined();
    });
  });

  describe("updateManifest", () => {
    it("should add a new entry when manifest does not exist", () => {
      const entry: ManifestExport = {
        artifact: "schema.sql",
        format: "ddl",
        exportedAt: "2026-03-06T12:00:00Z",
        modelHash: "abc123",
        sources: [
          {
            elementId: "entity-1",
            elementType: "EntityType",
            elementName: "Customer",
          },
        ],
      };

      const manifest = updateManifest(tempDir, entry);

      expect(manifest.version).toBe(1);
      expect(manifest.exports).toHaveLength(1);
      expect(manifest.exports[0]).toEqual(entry);
      expect(manifest.sourceModelHash).toBe("abc123");
    });

    it("should append a new entry to existing manifest", () => {
      const initial: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: "abc123",
        exports: [
          {
            artifact: "schema.sql",
            format: "ddl",
            exportedAt: "2026-03-06T12:00:00Z",
            modelHash: "abc123",
            sources: [],
          },
        ],
      };

      writeManifest(tempDir, initial);

      const newEntry: ManifestExport = {
        artifact: "models/customer.sql",
        format: "dbt",
        exportedAt: "2026-03-06T13:00:00Z",
        modelHash: "def456",
        sources: [],
      };

      const updated = updateManifest(tempDir, newEntry);

      expect(updated.exports).toHaveLength(2);
      expect(updated.exports[0].artifact).toBe("schema.sql");
      expect(updated.exports[1].artifact).toBe("models/customer.sql");
      expect(updated.sourceModelHash).toBe("def456");
    });

    it("should replace an existing entry when artifact path matches", () => {
      const initial: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: "abc123",
        exports: [
          {
            artifact: "schema.sql",
            format: "ddl",
            exportedAt: "2026-03-06T12:00:00Z",
            modelHash: "abc123",
            sources: [],
          },
        ],
      };

      writeManifest(tempDir, initial);

      const updatedEntry: ManifestExport = {
        artifact: "schema.sql",
        format: "ddl",
        exportedAt: "2026-03-06T14:00:00Z",
        modelHash: "xyz789",
        sources: [
          {
            elementId: "entity-2",
            elementType: "EntityType",
            elementName: "Order",
          },
        ],
      };

      const updated = updateManifest(tempDir, updatedEntry);

      expect(updated.exports).toHaveLength(1);
      expect(updated.exports[0].exportedAt).toBe("2026-03-06T14:00:00Z");
      expect(updated.exports[0].modelHash).toBe("xyz789");
      expect(updated.exports[0].sources).toHaveLength(1);
    });

    it("should accept existingManifest parameter to avoid re-reading", () => {
      const existing: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: "abc123",
        exports: [],
      };

      const entry: ManifestExport = {
        artifact: "schema.sql",
        format: "ddl",
        exportedAt: "2026-03-06T12:00:00Z",
        modelHash: "def456",
        sources: [],
      };

      const updated = updateManifest(tempDir, entry, existing);

      expect(updated.exports).toHaveLength(1);
      expect(updated.sourceModelHash).toBe("def456");
    });
  });

  describe("hashModel", () => {
    it("should produce a deterministic hash for the same model", () => {
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "id" })
        .build();

      const hash1 = hashModel(model);
      const hash2 = hashModel(model);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex digest is 64 characters
    });

    it("should produce different hashes for different models", () => {
      const model1 = new ModelBuilder("Test Model 1")
        .withEntityType("Customer", { referenceMode: "id" })
        .build();

      const model2 = new ModelBuilder("Test Model 2")
        .withEntityType("Order", { referenceMode: "id" })
        .build();

      const hash1 = hashModel(model1);
      const hash2 = hashModel(model2);

      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hashes when model is modified", () => {
      const model1 = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "id" })
        .build();

      const hash1 = hashModel(model1);

      // Add another entity
      const model2 = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "id" })
        .withEntityType("Order", { referenceMode: "id" })
        .build();

      const hash2 = hashModel(model2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Staleness detection", () => {
    it("should detect when model has changed since export", () => {
      // Create initial model
      const model1 = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "id" })
        .build();

      const hash1 = hashModel(model1);

      // Write manifest with initial hash
      const manifest: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: hash1,
        exports: [
          {
            artifact: "schema.sql",
            format: "ddl",
            exportedAt: "2026-03-06T12:00:00Z",
            modelHash: hash1,
            sources: [],
          },
        ],
      };

      writeManifest(tempDir, manifest);

      // Modify model
      const model2 = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "id" })
        .withEntityType("Order", { referenceMode: "id" })
        .build();

      const hash2 = hashModel(model2);

      // Verify hashes differ
      expect(hash2).not.toBe(hash1);

      // Read manifest and check staleness
      const readBack = readManifest(tempDir);
      expect(readBack).toBeDefined();
      expect(readBack!.sourceModelHash).toBe(hash1);
      expect(readBack!.sourceModelHash).not.toBe(hash2);

      // The manifest indicates the export is stale
      const isStale = readBack!.sourceModelHash !== hash2;
      expect(isStale).toBe(true);
    });

    it("should detect when model has not changed since export", () => {
      // Create model
      const model = new ModelBuilder("Test Model")
        .withEntityType("Customer", { referenceMode: "id" })
        .build();

      const hash = hashModel(model);

      // Write manifest
      const manifest: LineageManifest = {
        version: 1,
        sourceModel: "test.orm.yaml",
        sourceModelHash: hash,
        exports: [
          {
            artifact: "schema.sql",
            format: "ddl",
            exportedAt: "2026-03-06T12:00:00Z",
            modelHash: hash,
            sources: [],
          },
        ],
      };

      writeManifest(tempDir, manifest);

      // Read manifest and verify
      const readBack = readManifest(tempDir);
      expect(readBack).toBeDefined();

      const currentHash = hashModel(model);
      const isStale = readBack!.sourceModelHash !== currentHash;
      expect(isStale).toBe(false);
    });
  });
});
