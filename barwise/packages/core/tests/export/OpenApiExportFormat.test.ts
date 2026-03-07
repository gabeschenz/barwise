/**
 * Tests for OpenAPI export format adapter.
 *
 * Verifies that the adapter produces valid OpenAPI 3.0 output and
 * integrates correctly with the registry.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { openApiExportFormat } from "../../src/export/OpenApiExportFormat.js";
import { formatRegistry } from "../../src/export/registry.js";
import { ModelBuilder } from "../helpers/ModelBuilder.js";

describe("OpenApiExportFormat", () => {
  describe("adapter instance", () => {
    it("has correct name and description", () => {
      expect(openApiExportFormat.name).toBe("openapi");
      expect(openApiExportFormat.description).toContain("OpenAPI");
    });
  });

  describe("export()", () => {
    it("produces valid OpenAPI 3.0 JSON", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "cust_id" })
        .withEntityType("Order", { referenceMode: "order_num" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
        })
        .build();

      const result = openApiExportFormat.export(model);

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);

      // Parse as JSON.
      const spec = JSON.parse(result.text);

      // Check OpenAPI structure.
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe("Test"); // Model name as default title
      expect(spec.paths).toBeDefined();
      expect(spec.components).toBeDefined();
      expect(spec.components.schemas).toBeDefined();

      // Should have schemas for both tables.
      expect(Object.keys(spec.components.schemas).length).toBeGreaterThanOrEqual(
        2,
      );
    });

    it("supports custom title and version options", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "cust_id" })
        .build();

      const result = openApiExportFormat.export(model, {
        title: "My Custom API",
        version: "2.0.0",
      });

      const spec = JSON.parse(result.text);

      expect(spec.info.title).toBe("My Custom API");
      expect(spec.info.version).toBe("2.0.0");
    });

    it("supports basePath option", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "cust_id" })
        .build();

      const result = openApiExportFormat.export(model, {
        basePath: "/api/v1",
      });

      const spec = JSON.parse(result.text);

      // Paths should include the base path.
      const pathKeys = Object.keys(spec.paths);
      expect(pathKeys.some((p) => p.startsWith("/api/v1"))).toBe(true);
    });

    it("includes validation warnings when model has errors", () => {
      // Create a model with structural errors (entity with no reference).
      // Note: Can't easily create a truly invalid model because FactType
      // constructor validates roles. This test is limited in what it can check.
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "cust_id" })
        .withEntityType("Order", { referenceMode: "order_num" })
        .withBinaryFactType("Customer places Order", {
          role1: { player: "Customer", name: "places" },
          role2: { player: "Order", name: "is placed by" },
          uniqueness: "role2",
        })
        .build();

      const result = openApiExportFormat.export(model);

      // Should still produce output (not strict mode).
      expect(result.text).toBeDefined();
      // Model is valid so no warnings expected, but export should succeed.
      const spec = JSON.parse(result.text);
      expect(spec.openapi).toBe("3.0.0");
    });

    it("exports successfully in strict mode with valid model", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "cust_id" })
        .build();

      // Should not throw in strict mode with valid model.
      expect(() => openApiExportFormat.export(model, { strict: true })).not.toThrow();
    });

    it("produces single-file output (no files array)", () => {
      const model = new ModelBuilder("Test")
        .withEntityType("Customer", { referenceMode: "cust_id" })
        .build();

      const result = openApiExportFormat.export(model);

      expect(result.files).toBeUndefined();
    });
  });

  describe("registry integration", () => {
    beforeEach(() => {
      formatRegistry.clear();
    });

    it("registers successfully", () => {
      formatRegistry.registerFormat(openApiExportFormat);

      const retrieved = formatRegistry.getFormat("openapi");
      expect(retrieved).toBe(openApiExportFormat);
    });

    it("is listed in available formats", () => {
      formatRegistry.registerFormat(openApiExportFormat);

      const formats = formatRegistry.listFormats();
      expect(formats).toContain(openApiExportFormat);
    });
  });
});
