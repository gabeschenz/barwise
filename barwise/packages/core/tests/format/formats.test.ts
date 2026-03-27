/**
 * Tests for built-in format descriptors and registerBuiltinFormats.
 *
 * Verifies that all built-in descriptors (DDL, OpenAPI, dbt, Avro) are
 * correctly shaped and that registerBuiltinFormats populates the unified
 * registry.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  avroFormat,
  dbtFormat,
  ddlFormat,
  openApiFormat,
  registerBuiltinFormats,
} from "../../src/format/formats.js";
import {
  clearFormats,
  formatRegistry,
  getExporter,
  getFormat,
  getImporter,
  listExporters,
  listFormats,
  listImporters,
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

  describe("dbtFormat", () => {
    it("has name 'dbt'", () => {
      expect(dbtFormat.name).toBe("dbt");
    });

    it("has a description", () => {
      expect(dbtFormat.description).toBeTruthy();
    });

    it("has both importer and exporter", () => {
      expect(dbtFormat.importer).toBeDefined();
      expect(dbtFormat.exporter).toBeDefined();
    });

    it("importer has inputKind 'directory'", () => {
      expect(dbtFormat.importer!.inputKind).toBe("directory");
    });

    it("importer has parseAsync but not parse", () => {
      expect(dbtFormat.importer!.parseAsync).toBeDefined();
      expect(dbtFormat.importer!.parse).toBeUndefined();
    });

    it("exporter has the export method", () => {
      expect(typeof dbtFormat.exporter!.export).toBe("function");
    });
  });

  describe("avroFormat", () => {
    it("has name 'avro'", () => {
      expect(avroFormat.name).toBe("avro");
    });

    it("has a description", () => {
      expect(avroFormat.description).toBeTruthy();
    });

    it("has exporter only (no importer)", () => {
      expect(avroFormat.importer).toBeUndefined();
      expect(avroFormat.exporter).toBeDefined();
    });

    it("exporter has the export method", () => {
      expect(typeof avroFormat.exporter!.export).toBe("function");
    });
  });
});

describe("registerBuiltinFormats", () => {
  beforeEach(() => {
    clearFormats();
  });

  it("registers all built-in formats", () => {
    registerBuiltinFormats();

    expect(getFormat("ddl")).toBeDefined();
    expect(getFormat("openapi")).toBeDefined();
    expect(getFormat("dbt")).toBeDefined();
    expect(getFormat("avro")).toBeDefined();
    expect(listFormats()).toHaveLength(4);
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

    // 3 formats (ddl, openapi, dbt) have importers.
    expect(importers).toHaveLength(3);
    // 4 formats (ddl, openapi, dbt, avro) have exporters.
    expect(exporters).toHaveLength(4);
    expect(importers.map((f) => f.name).sort()).toEqual(["dbt", "ddl", "openapi"]);
    expect(exporters.map((f) => f.name).sort()).toEqual(["avro", "dbt", "ddl", "openapi"]);
  });

  it("is idempotent -- safe to call multiple times", () => {
    registerBuiltinFormats();
    registerBuiltinFormats();
    registerBuiltinFormats();

    expect(listFormats()).toHaveLength(4);
  });

  it("skips already-registered formats", () => {
    // Pre-register DDL manually.
    formatRegistry.register(ddlFormat);

    // registerBuiltinFormats should skip DDL and register the rest.
    registerBuiltinFormats();

    expect(listFormats()).toHaveLength(4);
    expect(getFormat("ddl")).toBe(ddlFormat);
    expect(getFormat("openapi")).toBeDefined();
    expect(getFormat("dbt")).toBeDefined();
    expect(getFormat("avro")).toBeDefined();
  });
});
