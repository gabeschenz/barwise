/**
 * Tests for export_model MCP tool.
 *
 * Verifies that the tool dispatches to the correct format adapter
 * and handles errors appropriately.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { executeExportModel } from "../../src/tools/exportModel.js";
import { OrmYamlSerializer } from "@fregma/core";

const serializer = new OrmYamlSerializer();

describe("export_model tool", () => {
  const simpleModel = `
name: Test Model
object_types:
  - name: Customer
    kind: entity
    is_independent: true
    reference_mode: cust_id
  - name: Order
    kind: entity
    is_independent: true
    reference_mode: order_num
fact_types:
  - name: Customer places Order
    roles:
      - name: places
        player: Customer
      - name: is placed by
        player: Order
    readings:
      - template: "{0} places {1}"
        role_order: [0, 1]
    constraints:
      - type: internal_uniqueness
        covers_roles: [1]
`;

  beforeEach(() => {
    // The format registration happens on module load in exportModel.ts,
    // so no explicit registration needed here.
  });

  describe("DDL format", () => {
    it("produces DDL output", () => {
      const result = executeExportModel(simpleModel, "ddl");

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.type).toBe("text");
      expect(result.content[0]!.text).toContain("CREATE TABLE");
    });

    it("supports annotate option", () => {
      const result = executeExportModel(simpleModel, "ddl", {
        annotate: true,
      });

      expect(result.content[0]!.text).toContain("--");
    });
  });

  describe("OpenAPI format", () => {
    it("produces OpenAPI JSON", () => {
      const result = executeExportModel(simpleModel, "openapi");

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.type).toBe("text");

      const text = result.content[0]!.text;
      expect(text).toContain('"openapi": "3.0.0"');

      // Verify it's valid JSON.
      const spec = JSON.parse(text);
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.components.schemas).toBeDefined();
    });

    it("supports format-specific options", () => {
      const result = executeExportModel(simpleModel, "openapi", {
        title: "My API",
        version: "2.0.0",
      });

      const text = result.content[0]!.text;
      const spec = JSON.parse(text);

      expect(spec.info.title).toBe("My API");
      expect(spec.info.version).toBe("2.0.0");
    });
  });

  describe("unknown format", () => {
    it("returns error for unknown format", () => {
      const result = executeExportModel(simpleModel, "unknown_format");

      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("Unknown export format");
      expect(parsed.error).toContain("unknown_format");
    });
  });

  describe("strict mode", () => {
    it("returns error when model has validation errors in strict mode", () => {
      // Create a model with validation errors.
      const invalidModel = `
name: Invalid Model
object_types:
  - name: Customer
    kind: entity
    is_independent: true
fact_types:
  - name: InvalidFact
    roles: []
    readings: []
`;

      const result = executeExportModel(invalidModel, "ddl", {
        strict: true,
      });

      expect(result.content).toHaveLength(1);
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("validation errors");
    });
  });

  describe("inline vs file source", () => {
    it("accepts inline YAML", () => {
      const result = executeExportModel(simpleModel, "ddl");

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.text).toContain("CREATE TABLE");
    });

    // File path testing requires actual file system interaction,
    // which is covered by integration tests.
  });
});
