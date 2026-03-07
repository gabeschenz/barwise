/**
 * Tests for the unified format registry.
 *
 * Verifies that the registry correctly registers, retrieves, lists,
 * and filters format descriptors that bundle import and/or export
 * capabilities.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { ExportFormatAdapter } from "../../src/export/types.js";
import {
  clearFormats,
  formatRegistry,
  FormatRegistryError,
  getExporter,
  getFormat,
  getImporter,
  listExporters,
  listFormats,
  listImporters,
  registerFormat,
} from "../../src/format/registry.js";
import type { FormatDescriptor } from "../../src/format/types.js";
import type { ImportFormat, ImportOptions, ImportResult } from "../../src/import/types.js";
import { OrmModel } from "../../src/model/OrmModel.js";

// -- Test helpers ------------------------------------------------------------

function makeImporter(name: string): ImportFormat {
  return {
    name,
    description: `${name} importer`,
    parse: (_input: string, _options?: ImportOptions): ImportResult => ({
      model: new OrmModel({ name: "Test" }),
      warnings: [],
      confidence: "high",
    }),
  };
}

function makeExporter(name: string): ExportFormatAdapter {
  return {
    name,
    description: `${name} exporter`,
    export: () => ({ text: `${name} output` }),
  };
}

function makeBidirectional(name: string): FormatDescriptor {
  return {
    name,
    description: `${name} format (bidirectional)`,
    importer: makeImporter(name),
    exporter: makeExporter(name),
  };
}

function makeImportOnly(name: string): FormatDescriptor {
  return {
    name,
    description: `${name} format (import only)`,
    importer: makeImporter(name),
  };
}

function makeExportOnly(name: string): FormatDescriptor {
  return {
    name,
    description: `${name} format (export only)`,
    exporter: makeExporter(name),
  };
}

// -- Tests -------------------------------------------------------------------

describe("Unified format registry", () => {
  beforeEach(() => {
    clearFormats();
  });

  describe("registerFormat", () => {
    it("registers a bidirectional format", () => {
      const descriptor = makeBidirectional("ddl");

      registerFormat(descriptor);

      const retrieved = getFormat("ddl");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("ddl");
      expect(retrieved?.importer).toBeDefined();
      expect(retrieved?.exporter).toBeDefined();
    });

    it("registers an import-only format", () => {
      const descriptor = makeImportOnly("norma");

      registerFormat(descriptor);

      const retrieved = getFormat("norma");
      expect(retrieved).toBeDefined();
      expect(retrieved?.importer).toBeDefined();
      expect(retrieved?.exporter).toBeUndefined();
    });

    it("registers an export-only format", () => {
      const descriptor = makeExportOnly("avro");

      registerFormat(descriptor);

      const retrieved = getFormat("avro");
      expect(retrieved).toBeDefined();
      expect(retrieved?.importer).toBeUndefined();
      expect(retrieved?.exporter).toBeDefined();
    });

    it("throws FormatRegistryError when registering duplicate name", () => {
      registerFormat(makeBidirectional("ddl"));

      expect(() => registerFormat(makeBidirectional("ddl"))).toThrow(
        FormatRegistryError,
      );
      expect(() => registerFormat(makeImportOnly("ddl"))).toThrow(
        /already registered/,
      );
    });

    it("throws FormatRegistryError when neither importer nor exporter provided", () => {
      const empty: FormatDescriptor = {
        name: "empty",
        description: "No capabilities",
      };

      expect(() => registerFormat(empty)).toThrow(FormatRegistryError);
      expect(() => registerFormat(empty)).toThrow(
        /must have at least one of importer or exporter/,
      );
    });

    it("allows multiple distinct formats", () => {
      registerFormat(makeBidirectional("ddl"));
      registerFormat(makeImportOnly("norma"));
      registerFormat(makeExportOnly("avro"));

      expect(getFormat("ddl")).toBeDefined();
      expect(getFormat("norma")).toBeDefined();
      expect(getFormat("avro")).toBeDefined();
    });
  });

  describe("getFormat", () => {
    it("returns undefined for unregistered format", () => {
      expect(getFormat("nonexistent")).toBeUndefined();
    });

    it("retrieves registered format by exact name", () => {
      const descriptor = makeBidirectional("openapi");
      registerFormat(descriptor);

      expect(getFormat("openapi")).toBe(descriptor);
    });

    it("is case-sensitive", () => {
      registerFormat(makeBidirectional("ddl"));

      expect(getFormat("DDL")).toBeUndefined();
      expect(getFormat("Ddl")).toBeUndefined();
    });
  });

  describe("getImporter", () => {
    it("returns importer for bidirectional format", () => {
      const descriptor = makeBidirectional("ddl");
      registerFormat(descriptor);

      const importer = getImporter("ddl");
      expect(importer).toBe(descriptor.importer);
    });

    it("returns importer for import-only format", () => {
      const descriptor = makeImportOnly("norma");
      registerFormat(descriptor);

      const importer = getImporter("norma");
      expect(importer).toBe(descriptor.importer);
    });

    it("returns undefined for export-only format", () => {
      registerFormat(makeExportOnly("avro"));

      expect(getImporter("avro")).toBeUndefined();
    });

    it("returns undefined for unregistered format", () => {
      expect(getImporter("unknown")).toBeUndefined();
    });
  });

  describe("getExporter", () => {
    it("returns exporter for bidirectional format", () => {
      const descriptor = makeBidirectional("ddl");
      registerFormat(descriptor);

      const exporter = getExporter("ddl");
      expect(exporter).toBe(descriptor.exporter);
    });

    it("returns exporter for export-only format", () => {
      const descriptor = makeExportOnly("avro");
      registerFormat(descriptor);

      const exporter = getExporter("avro");
      expect(exporter).toBe(descriptor.exporter);
    });

    it("returns undefined for import-only format", () => {
      registerFormat(makeImportOnly("norma"));

      expect(getExporter("norma")).toBeUndefined();
    });

    it("returns undefined for unregistered format", () => {
      expect(getExporter("unknown")).toBeUndefined();
    });
  });

  describe("listFormats", () => {
    it("returns empty array when no formats registered", () => {
      expect(listFormats()).toEqual([]);
    });

    it("lists all registered formats", () => {
      registerFormat(makeBidirectional("ddl"));
      registerFormat(makeImportOnly("norma"));
      registerFormat(makeExportOnly("avro"));

      const formats = listFormats();
      expect(formats).toHaveLength(3);
      expect(formats.map((f) => f.name).sort()).toEqual([
        "avro",
        "ddl",
        "norma",
      ]);
    });
  });

  describe("listImporters", () => {
    it("returns empty array when no formats registered", () => {
      expect(listImporters()).toEqual([]);
    });

    it("returns only formats with import capability", () => {
      registerFormat(makeBidirectional("ddl"));
      registerFormat(makeImportOnly("norma"));
      registerFormat(makeExportOnly("avro"));

      const importers = listImporters();
      expect(importers).toHaveLength(2);
      expect(importers.map((f) => f.name).sort()).toEqual(["ddl", "norma"]);
    });

    it("excludes export-only formats", () => {
      registerFormat(makeExportOnly("avro"));
      registerFormat(makeExportOnly("svg"));

      expect(listImporters()).toHaveLength(0);
    });
  });

  describe("listExporters", () => {
    it("returns empty array when no formats registered", () => {
      expect(listExporters()).toEqual([]);
    });

    it("returns only formats with export capability", () => {
      registerFormat(makeBidirectional("ddl"));
      registerFormat(makeImportOnly("norma"));
      registerFormat(makeExportOnly("avro"));

      const exporters = listExporters();
      expect(exporters).toHaveLength(2);
      expect(exporters.map((f) => f.name).sort()).toEqual(["avro", "ddl"]);
    });

    it("excludes import-only formats", () => {
      registerFormat(makeImportOnly("norma"));
      registerFormat(makeImportOnly("dbt"));

      expect(listExporters()).toHaveLength(0);
    });
  });

  describe("clearFormats", () => {
    it("removes all registered formats", () => {
      registerFormat(makeBidirectional("ddl"));
      registerFormat(makeImportOnly("norma"));
      expect(listFormats()).toHaveLength(2);

      clearFormats();
      expect(listFormats()).toHaveLength(0);
      expect(getFormat("ddl")).toBeUndefined();
      expect(getFormat("norma")).toBeUndefined();
    });

    it("allows re-registration after clear", () => {
      const descriptor = makeBidirectional("ddl");
      registerFormat(descriptor);

      clearFormats();

      expect(() => registerFormat(descriptor)).not.toThrow();
      expect(getFormat("ddl")).toBe(descriptor);
    });
  });

  describe("formatRegistry direct access", () => {
    it("register and clear methods work on the singleton", () => {
      const descriptor = makeBidirectional("test");
      formatRegistry.register(descriptor);
      expect(formatRegistry.get("test")).toBe(descriptor);

      formatRegistry.clear();
      expect(formatRegistry.get("test")).toBeUndefined();
    });

    it("filtered views are consistent with convenience functions", () => {
      registerFormat(makeBidirectional("ddl"));
      registerFormat(makeImportOnly("norma"));
      registerFormat(makeExportOnly("avro"));

      expect(formatRegistry.list()).toEqual(listFormats());
      expect(formatRegistry.listImporters()).toEqual(listImporters());
      expect(formatRegistry.listExporters()).toEqual(listExporters());
    });
  });
});
