import { beforeEach, describe, expect, it } from "vitest";
import {
  clearImportFormats,
  getImportFormat,
  ImportFormatError,
  listImportFormats,
  registerImportFormat,
} from "../../src/import/registry.js";
import type { ImportFormat, ImportOptions, ImportResult } from "../../src/import/types.js";
import { OrmModel } from "../../src/model/OrmModel.js";

describe("Import Format Registry", () => {
  // Clean up before each test
  beforeEach(() => {
    clearImportFormats();
  });

  describe("registerImportFormat", () => {
    it("should register a new format", () => {
      const format: ImportFormat = {
        name: "test",
        description: "Test format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      registerImportFormat(format);

      const retrieved = getImportFormat("test");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("test");
      expect(retrieved?.description).toBe("Test format");
    });

    it("should throw error when registering duplicate format", () => {
      const format1: ImportFormat = {
        name: "duplicate",
        description: "First format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      const format2: ImportFormat = {
        name: "duplicate",
        description: "Second format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      registerImportFormat(format1);

      expect(() => registerImportFormat(format2)).toThrow(ImportFormatError);
      expect(() => registerImportFormat(format2)).toThrow(/already registered/);
    });
  });

  describe("getImportFormat", () => {
    it("should return undefined for unknown format", () => {
      const format = getImportFormat("unknown");
      expect(format).toBeUndefined();
    });

    it("should retrieve registered format", () => {
      const testFormat: ImportFormat = {
        name: "myformat",
        description: "My format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      registerImportFormat(testFormat);

      const retrieved = getImportFormat("myformat");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myformat");
    });
  });

  describe("listImportFormats", () => {
    it("should return empty array when no formats registered", () => {
      const formats = listImportFormats();
      expect(formats).toEqual([]);
    });

    it("should return all registered formats", () => {
      const format1: ImportFormat = {
        name: "format1",
        description: "First format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      const format2: ImportFormat = {
        name: "format2",
        description: "Second format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      registerImportFormat(format1);
      registerImportFormat(format2);

      const formats = listImportFormats();
      expect(formats).toHaveLength(2);
      expect(formats.map((f) => f.name).sort()).toEqual(["format1", "format2"]);
    });
  });

  describe("clearImportFormats", () => {
    it("should clear all registered formats", () => {
      const format: ImportFormat = {
        name: "test",
        description: "Test format",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Test" }),
          warnings: [],
          confidence: "high",
        }),
      };

      registerImportFormat(format);
      expect(listImportFormats()).toHaveLength(1);

      clearImportFormats();
      expect(listImportFormats()).toHaveLength(0);
    });
  });

  describe("format with enrich method", () => {
    it("should support formats with optional enrich method", () => {
      const formatWithEnrich: ImportFormat = {
        name: "enrichable",
        description: "Format with enrichment",
        parse: (_input: string, _options?: ImportOptions): ImportResult => ({
          model: new OrmModel({ name: "Draft" }),
          warnings: [],
          confidence: "medium",
        }),
        enrich: async (
          draft: ImportResult,
          _input: string,
          _llm: unknown,
          _options?: ImportOptions,
        ): Promise<ImportResult> => ({
          model: draft.model,
          warnings: draft.warnings,
          confidence: "high",
        }),
      };

      registerImportFormat(formatWithEnrich);

      const retrieved = getImportFormat("enrichable");
      expect(retrieved).toBeDefined();
      expect(retrieved?.enrich).toBeDefined();
      expect(typeof retrieved?.enrich).toBe("function");
    });
  });
});
