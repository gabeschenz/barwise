/**
 * Tests for the import format type system.
 *
 * Verifies backward compatibility of the ImportFormat interface evolution:
 * - Text-based formats with parse() continue to work
 * - Directory-based formats with parseAsync() are properly typed
 * - inputKind defaults to "text" when omitted
 */
import { describe, expect, it } from "vitest";
import type { ImportFormat, ImportOptions, ImportResult } from "../../src/import/types.js";
import { OrmModel } from "../../src/model/OrmModel.js";

// -- Test helpers ------------------------------------------------------------

function makeTextImporter(): ImportFormat {
  return {
    name: "text-test",
    description: "Test text importer",
    // inputKind omitted -- defaults to "text"
    parse(_input: string, _options?: ImportOptions): ImportResult {
      return {
        model: new OrmModel({ name: "Test" }),
        warnings: [],
        confidence: "high",
      };
    },
  };
}

function makeDirectoryImporter(): ImportFormat {
  return {
    name: "dir-test",
    description: "Test directory importer",
    inputKind: "directory",
    async parseAsync(_input: string, _options?: ImportOptions): Promise<ImportResult> {
      return {
        model: new OrmModel({ name: "Dir Test" }),
        warnings: [],
        confidence: "medium",
      };
    },
  };
}

function makeBothImporter(): ImportFormat {
  return {
    name: "both-test",
    description: "Test both importer",
    inputKind: "text",
    parse(_input: string, _options?: ImportOptions): ImportResult {
      return {
        model: new OrmModel({ name: "Sync" }),
        warnings: [],
        confidence: "high",
      };
    },
    async parseAsync(_input: string, _options?: ImportOptions): Promise<ImportResult> {
      return {
        model: new OrmModel({ name: "Async" }),
        warnings: [],
        confidence: "medium",
      };
    },
  };
}

// -- Tests -------------------------------------------------------------------

describe("ImportFormat interface evolution", () => {
  describe("backward compatibility", () => {
    it("text-based format with parse() works without inputKind", () => {
      const format = makeTextImporter();

      expect(format.inputKind).toBeUndefined();
      expect(format.parse).toBeDefined();
      expect(format.parseAsync).toBeUndefined();

      const result = format.parse!("test input");
      expect(result.model).toBeDefined();
      expect(result.confidence).toBe("high");
    });

    it("parse() is optional on ImportFormat (directory formats omit it)", () => {
      const format = makeDirectoryImporter();

      expect(format.parse).toBeUndefined();
      expect(format.parseAsync).toBeDefined();
    });
  });

  describe("directory-based formats", () => {
    it("directory format declares inputKind 'directory'", () => {
      const format = makeDirectoryImporter();
      expect(format.inputKind).toBe("directory");
    });

    it("directory format implements parseAsync()", async () => {
      const format = makeDirectoryImporter();

      const result = await format.parseAsync!("/some/path");
      expect(result.model.name).toBe("Dir Test");
      expect(result.confidence).toBe("medium");
    });
  });

  describe("formats supporting both modes", () => {
    it("can implement both parse() and parseAsync()", async () => {
      const format = makeBothImporter();

      expect(format.parse).toBeDefined();
      expect(format.parseAsync).toBeDefined();

      const syncResult = format.parse!("sync input");
      expect(syncResult.model.name).toBe("Sync");

      const asyncResult = await format.parseAsync!("/async/path");
      expect(asyncResult.model.name).toBe("Async");
    });
  });

  describe("enrich() remains unchanged", () => {
    it("enrich is still optional on all format types", () => {
      const textFormat = makeTextImporter();
      const dirFormat = makeDirectoryImporter();

      expect(textFormat.enrich).toBeUndefined();
      expect(dirFormat.enrich).toBeUndefined();
    });
  });
});
