/**
 * Tests for export format registry.
 *
 * Verifies that the registry correctly registers, retrieves, and lists
 * export formats.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ddlExportFormat } from "../../src/export/DdlExportFormat.js";
import {
  formatRegistry,
  getFormat,
  listFormats,
  registerFormat,
} from "../../src/export/registry.js";
import type { ExportFormatAdapter } from "../../src/export/types.js";

describe("Export format registry", () => {
  // Clear registry before each test to ensure isolation.
  beforeEach(() => {
    formatRegistry.clear();
  });

  describe("format registration", () => {
    it("registers a format by name", () => {
      registerFormat(ddlExportFormat);

      const retrieved = getFormat("ddl");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("ddl");
    });

    it("throws when registering duplicate format names", () => {
      registerFormat(ddlExportFormat);

      // Try to register again.
      expect(() => registerFormat(ddlExportFormat)).toThrow(
        'Export format "ddl" is already registered.',
      );
    });

    it("allows multiple distinct formats", () => {
      const mockFormat1: ExportFormatAdapter = {
        name: "format1",
        description: "Test format 1",
        export: () => ({ text: "test1" }),
      };

      const mockFormat2: ExportFormatAdapter = {
        name: "format2",
        description: "Test format 2",
        export: () => ({ text: "test2" }),
      };

      registerFormat(mockFormat1);
      registerFormat(mockFormat2);

      expect(getFormat("format1")).toBe(mockFormat1);
      expect(getFormat("format2")).toBe(mockFormat2);
    });
  });

  describe("format retrieval", () => {
    it("returns undefined for unregistered format", () => {
      const result = getFormat("nonexistent");
      expect(result).toBeUndefined();
    });

    it("retrieves registered format by name", () => {
      registerFormat(ddlExportFormat);

      const result = getFormat("ddl");
      expect(result).toBe(ddlExportFormat);
    });

    it("is case-sensitive", () => {
      registerFormat(ddlExportFormat);

      const result = getFormat("DDL");
      expect(result).toBeUndefined();
    });
  });

  describe("format listing", () => {
    it("returns empty array when no formats registered", () => {
      const formats = listFormats();
      expect(formats).toEqual([]);
    });

    it("lists all registered formats", () => {
      const mockFormat1: ExportFormatAdapter = {
        name: "format1",
        description: "Test format 1",
        export: () => ({ text: "test1" }),
      };

      const mockFormat2: ExportFormatAdapter = {
        name: "format2",
        description: "Test format 2",
        export: () => ({ text: "test2" }),
      };

      registerFormat(mockFormat1);
      registerFormat(mockFormat2);

      const formats = listFormats();
      expect(formats).toHaveLength(2);
      expect(formats).toContain(mockFormat1);
      expect(formats).toContain(mockFormat2);
    });

    it("returns readonly array", () => {
      registerFormat(ddlExportFormat);

      const formats = listFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(Object.isFrozen(formats)).toBe(false); // Array.from creates a new array
      expect(formats[0]).toBe(ddlExportFormat);
    });
  });

  describe("registry isolation", () => {
    it("clears all formats", () => {
      registerFormat(ddlExportFormat);
      expect(listFormats()).toHaveLength(1);

      formatRegistry.clear();
      expect(listFormats()).toHaveLength(0);
      expect(getFormat("ddl")).toBeUndefined();
    });

    it("starts empty after clear", () => {
      const mockFormat: ExportFormatAdapter = {
        name: "test",
        description: "Test format",
        export: () => ({ text: "test" }),
      };

      registerFormat(mockFormat);
      formatRegistry.clear();

      // Should be able to re-register after clear.
      expect(() => registerFormat(mockFormat)).not.toThrow();
      expect(getFormat("test")).toBe(mockFormat);
    });
  });
});
