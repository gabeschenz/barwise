/**
 * Tests for export_model MCP tool.
 *
 * Verifies that the tool dispatches to the correct format adapter
 * and handles errors appropriately.
 */

import { OrmYamlSerializer } from "@barwise/core";
import { beforeEach, describe, expect, it } from "vitest";
import { executeExportModel } from "../../src/tools/exportModel.js";

const _serializer = new OrmYamlSerializer();

describe("export_model tool", () => {
  const simpleModel = `
orm_version: "1.0"
model:
  name: Test Model
  object_types:
    - id: ot-customer
      name: Customer
      kind: entity
      reference_mode: cust_id
    - id: ot-order
      name: Order
      kind: entity
      reference_mode: order_num
  fact_types:
    - id: ft-customer-places-order
      name: Customer places Order
      roles:
        - id: r-cust-places
          player: ot-customer
          role_name: places
        - id: r-order-placed-by
          player: ot-order
          role_name: is placed by
      readings:
        - "{0} places {1}"
      constraints:
        - type: internal_uniqueness
          roles: [r-order-placed-by]
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
      // Create a model with ORM validation errors (constraint references non-existent role).
      const invalidModel = `
orm_version: "1.0"
model:
  name: Invalid Model
  object_types:
    - id: ot-customer
      name: Customer
      kind: entity
      reference_mode: cust_id
    - id: ot-order
      name: Order
      kind: entity
      reference_mode: order_num
  fact_types:
    - id: ft-invalid
      name: Customer places Order
      roles:
        - id: r-1
          player: ot-customer
          role_name: places
        - id: r-2
          player: ot-order
          role_name: is placed by
      readings:
        - "{0} places {1}"
      constraints:
        - type: internal_uniqueness
          roles: [r-nonexistent]
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
