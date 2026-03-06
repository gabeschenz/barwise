import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { analyzeImpact } from "../../src/lineage/impact.js";
import { writeManifest } from "../../src/lineage/manifest.js";
import type { LineageManifest } from "../../src/lineage/types.js";

describe("Impact Analysis", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fregma-impact-test-"));
  });

  afterEach(() => {
    // Clean up the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should find all artifacts that depend on a changed element", () => {
    const customerEntityId = "entity-customer-123";

    const manifest: LineageManifest = {
      version: 1,
      sourceModel: "test.orm.yaml",
      sourceModelHash: "abc123",
      exports: [
        {
          artifact: "schema.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: customerEntityId,
              elementType: "EntityType",
              elementName: "Customer",
            },
            {
              elementId: "entity-order-456",
              elementType: "EntityType",
              elementName: "Order",
            },
          ],
        },
        {
          artifact: "models/customer.sql",
          format: "dbt",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: customerEntityId,
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
        {
          artifact: "models/order.sql",
          format: "dbt",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: "entity-order-456",
              elementType: "EntityType",
              elementName: "Order",
            },
          ],
        },
      ],
    };

    writeManifest(tempDir, manifest);

    const report = analyzeImpact(tempDir, customerEntityId);

    expect(report.changedElement).toBe(customerEntityId);
    expect(report.affectedArtifacts).toHaveLength(2);

    // Should find schema.sql
    const schemaSql = report.affectedArtifacts.find(a => a.artifact === "schema.sql");
    expect(schemaSql).toBeDefined();
    expect(schemaSql!.format).toBe("ddl");
    expect(schemaSql!.relationship).toContain("entity type Customer");

    // Should find models/customer.sql
    const customerSql = report.affectedArtifacts.find(a => a.artifact === "models/customer.sql");
    expect(customerSql).toBeDefined();
    expect(customerSql!.format).toBe("dbt");

    // Should NOT find models/order.sql (doesn't reference Customer)
    const orderSql = report.affectedArtifacts.find(a => a.artifact === "models/order.sql");
    expect(orderSql).toBeUndefined();
  });

  it("should return empty list when element has no dependent artifacts", () => {
    const unusedElementId = "entity-unused-999";

    const manifest: LineageManifest = {
      version: 1,
      sourceModel: "test.orm.yaml",
      sourceModelHash: "abc123",
      exports: [
        {
          artifact: "schema.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: "entity-customer-123",
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
      ],
    };

    writeManifest(tempDir, manifest);

    const report = analyzeImpact(tempDir, unusedElementId);

    expect(report.changedElement).toBe(unusedElementId);
    expect(report.affectedArtifacts).toHaveLength(0);
  });

  it("should return empty list when no manifest exists", () => {
    const report = analyzeImpact(tempDir, "some-element-id");

    expect(report.changedElement).toBe("some-element-id");
    expect(report.affectedArtifacts).toHaveLength(0);
  });

  it("should generate appropriate relationship descriptions for different element types", () => {
    const entityId = "entity-1";
    const valueTypeId = "value-1";
    const factTypeId = "fact-1";
    const constraintId = "constraint-1";
    const roleId = "role-1";

    const manifest: LineageManifest = {
      version: 1,
      sourceModel: "test.orm.yaml",
      sourceModelHash: "abc123",
      exports: [
        {
          artifact: "entity_artifact.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: entityId,
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
        {
          artifact: "value_artifact.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: valueTypeId,
              elementType: "ValueType",
              elementName: "Email",
            },
          ],
        },
        {
          artifact: "fact_artifact.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: factTypeId,
              elementType: "FactType",
              elementName: "Customer places Order",
            },
          ],
        },
        {
          artifact: "constraint_artifact.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: constraintId,
              elementType: "Constraint",
              elementName: "UC: Customer",
            },
          ],
        },
        {
          artifact: "role_artifact.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId: roleId,
              elementType: "Role",
              elementName: "places",
            },
          ],
        },
      ],
    };

    writeManifest(tempDir, manifest);

    // Test EntityType relationship
    const entityReport = analyzeImpact(tempDir, entityId);
    expect(entityReport.affectedArtifacts[0].relationship).toContain("entity type Customer");

    // Test ValueType relationship
    const valueReport = analyzeImpact(tempDir, valueTypeId);
    expect(valueReport.affectedArtifacts[0].relationship).toContain("value type Email");

    // Test FactType relationship
    const factReport = analyzeImpact(tempDir, factTypeId);
    expect(factReport.affectedArtifacts[0].relationship).toContain("fact type Customer places Order");

    // Test Constraint relationship
    const constraintReport = analyzeImpact(tempDir, constraintId);
    expect(constraintReport.affectedArtifacts[0].relationship).toContain("constraint UC: Customer");

    // Test Role relationship
    const roleReport = analyzeImpact(tempDir, roleId);
    expect(roleReport.affectedArtifacts[0].relationship).toContain("role places");
  });

  it("should handle multiple artifacts with different formats", () => {
    const elementId = "entity-customer-123";

    const manifest: LineageManifest = {
      version: 1,
      sourceModel: "test.orm.yaml",
      sourceModelHash: "abc123",
      exports: [
        {
          artifact: "schema.sql",
          format: "ddl",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId,
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
        {
          artifact: "models/customer.sql",
          format: "dbt",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId,
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
        {
          artifact: "openapi.yaml",
          format: "openapi",
          exportedAt: "2026-03-06T12:00:00Z",
          modelHash: "abc123",
          sources: [
            {
              elementId,
              elementType: "EntityType",
              elementName: "Customer",
            },
          ],
        },
      ],
    };

    writeManifest(tempDir, manifest);

    const report = analyzeImpact(tempDir, elementId);

    expect(report.affectedArtifacts).toHaveLength(3);

    const formats = report.affectedArtifacts.map(a => a.format);
    expect(formats).toContain("ddl");
    expect(formats).toContain("dbt");
    expect(formats).toContain("openapi");
  });
});
