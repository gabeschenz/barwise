/**
 * Tests for built-in format descriptors and registerBuiltinFormats.
 *
 * Verifies that the DDL and OpenAPI descriptors are correctly shaped
 * and that registerBuiltinFormats populates the unified registry.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ddlFormat,
  openApiFormat,
  registerBuiltinFormats,
} from "../../src/format/formats.js";
import {
  formatRegistry,
  clearFormats,
  getFormat,
  getImporter,
  getExporter,
  listFormats,
  listImporters,
  listExporters,
} from "../../src/format/registry.js";

describe("Built-in format descriptors", () => {
  describe("ddlFormat", () => {
    it("has name 'ddl'", () => {
      expect(ddlFormat.name).toBe("ddl");
    });

    it("has a description", () => {
      expect(ddlFormat.description).toBeTruthy();
    });

    it("has both importer and exporter", () => {
      expect(ddlFormat.importer).toBeDefined();
      expect(ddlFormat.exporter).toBeDefined();
    });

    it("importer can parse DDL", () => {
      const ddl = "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));";
      const result = ddlFormat.importer!.parse(ddl);

      expect(result.model).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it("exporter has the export method", () => {
      expect(typeof ddlFormat.exporter!.export).toBe("function");
    });
  });

  describe("openApiFormat", () => {
    it("has name 'openapi'", () => {
      expect(openApiFormat.name).toBe("openapi");
    });

    it("has a description", () => {
      expect(openApiFormat.description).toBeTruthy();
    });

    it("has both importer and exporter", () => {
      expect(openApiFormat.importer).toBeDefined();
      expect(openApiFormat.exporter).toBeDefined();
    });

    it("exporter has the export method", () => {
      expect(typeof openApiFormat.exporter!.export).toBe("function");
    });
  });
});

describe("registerBuiltinFormats", () => {
  beforeEach(() => {
    clearFormats();
  });

  it("registers DDL and OpenAPI formats", () => {
    registerBuiltinFormats();

    expect(getFormat("ddl")).toBeDefined();
    expect(getFormat("openapi")).toBeDefined();
    expect(listFormats()).toHaveLength(2);
  });

  it("makes DDL available as both importer and exporter", () => {
    registerBuiltinFormats();

    expect(getImporter("ddl")).toBeDefined();
    expect(getExporter("ddl")).toBeDefined();
  });

  it("makes OpenAPI available as both importer and exporter", () => {
    registerBuiltinFormats();

    expect(getImporter("openapi")).toBeDefined();
    expect(getExporter("openapi")).toBeDefined();
  });

  it("populates both importer and exporter lists", () => {
    registerBuiltinFormats();

    const importers = listImporters();
    const exporters = listExporters();

    expect(importers).toHaveLength(2);
    expect(exporters).toHaveLength(2);
    expect(importers.map((f) => f.name).sort()).toEqual(["ddl", "openapi"]);
    expect(exporters.map((f) => f.name).sort()).toEqual(["ddl", "openapi"]);
  });

  it("is idempotent -- safe to call multiple times", () => {
    registerBuiltinFormats();
    registerBuiltinFormats();
    registerBuiltinFormats();

    expect(listFormats()).toHaveLength(2);
  });

  it("skips already-registered formats", () => {
    // Pre-register DDL manually.
    formatRegistry.register(ddlFormat);

    // registerBuiltinFormats should skip DDL and register OpenAPI only.
    registerBuiltinFormats();

    expect(listFormats()).toHaveLength(2);
    expect(getFormat("ddl")).toBe(ddlFormat);
    expect(getFormat("openapi")).toBeDefined();
  });
});
