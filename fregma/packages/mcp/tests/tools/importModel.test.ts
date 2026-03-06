/**
 * Tests for the import_model tool.
 */
import { describe, it, expect } from "vitest";
import { executeImportModel } from "../../src/tools/importModel.js";

describe("import_model tool", () => {
  describe("DDL format", () => {
    it("should import simple DDL", async () => {
      const ddl = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100)
        );
      `;

      const result = await executeImportModel(ddl, "ddl", "Test Model");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("name: Test Model");
      expect(yaml).toContain("Users");
      expect(yaml).toContain("confidence: medium");
    });

    it("should import DDL with foreign keys", async () => {
      const ddl = `
        CREATE TABLE departments (
          id INT PRIMARY KEY,
          name VARCHAR(100)
        );

        CREATE TABLE employees (
          id INT PRIMARY KEY,
          name VARCHAR(100),
          department_id INT,
          FOREIGN KEY (department_id) REFERENCES departments (id)
        );
      `;

      const result = await executeImportModel(ddl, "ddl");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("Departments");
      expect(yaml).toContain("Employees");
      expect(yaml).toContain("fact_types");
    });

    it("should include warnings in output", async () => {
      const ddl = ""; // Empty DDL

      const result = await executeImportModel(ddl, "ddl");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("# Import Warnings:");
      expect(yaml).toContain("confidence: low");
    });
  });

  describe("OpenAPI format", () => {
    it("should import simple OpenAPI spec", async () => {
      const spec = JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        components: {
          schemas: {
            User: {
              type: "object",
              properties: {
                id: { type: "integer" },
                name: { type: "string" },
              },
              required: ["id", "name"],
            },
          },
        },
      });

      const result = await executeImportModel(spec, "openapi", "API Model");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("name: API Model");
      expect(yaml).toContain("User");
      expect(yaml).toContain("confidence: medium");
    });

    it("should import OpenAPI with relationships", async () => {
      const spec = JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        components: {
          schemas: {
            Department: {
              type: "object",
              properties: {
                id: { type: "integer" },
                name: { type: "string" },
              },
            },
            Employee: {
              type: "object",
              properties: {
                id: { type: "integer" },
                name: { type: "string" },
                department: {
                  $ref: "#/components/schemas/Department",
                },
              },
            },
          },
        },
      });

      const result = await executeImportModel(spec, "openapi");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("Department");
      expect(yaml).toContain("Employee");
      expect(yaml).toContain("fact_types");
    });

    it("should import OpenAPI YAML format", async () => {
      const yamlSpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
components:
  schemas:
    Product:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
      required:
        - id
        - name
`;

      const result = await executeImportModel(yamlSpec, "openapi");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("Product");
      expect(yaml).toContain("confidence: medium");
    });

    it("should include warnings for unsupported features", async () => {
      const spec = JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Test API", version: "1.0.0" },
        components: {
          schemas: {
            Pet: {
              type: "object",
              oneOf: [{ type: "object" }],
              properties: {
                id: { type: "integer" },
              },
            },
          },
        },
      });

      const result = await executeImportModel(spec, "openapi");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("# Import Warnings:");
      expect(yaml).toContain("oneOf");
    });
  });

  describe("unknown format", () => {
    it("should return error for unknown format", async () => {
      const result = await executeImportModel(
        "content",
        "unknown" as any,
      );
      const text = result.content[0]!.text;

      expect(text).toContain("Error");
      expect(text).toContain("Unknown import format");
    });
  });

  describe("MCP format", () => {
    it("should return content in MCP format", async () => {
      const ddl = "CREATE TABLE test (id INT PRIMARY KEY);";
      const result = await executeImportModel(ddl, "ddl");

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.type).toBe("text");
      expect(typeof result.content[0]!.text).toBe("string");
    });
  });

  describe("model naming", () => {
    it("should use provided model name", async () => {
      const ddl = "CREATE TABLE test (id INT PRIMARY KEY);";
      const result = await executeImportModel(ddl, "ddl", "Custom Name");
      const yaml = result.content[0]!.text;

      expect(yaml).toContain("name: Custom Name");
    });

    it("should use default model name if not provided", async () => {
      const ddl = "CREATE TABLE test (id INT PRIMARY KEY);";
      const result = await executeImportModel(ddl, "ddl");
      const yaml = result.content[0]!.text;

      // Should have some default name from the format
      expect(yaml).toMatch(/name:/);
    });
  });
});
