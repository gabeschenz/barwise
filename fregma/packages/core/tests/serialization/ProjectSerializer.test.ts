/**
 * Tests for ProjectSerializer (.orm-project.yaml file format).
 *
 * The project manifest lists domains, mappings, and data products with
 * their dependency relationships. These tests verify serialization,
 * deserialization (including error cases), round-trip fidelity, and
 * the getMappingPaths helper for extracting mapping file references.
 */
import { describe, it, expect } from "vitest";
import {
  ProjectSerializer,
  ProjectDeserializationError,
} from "../../src/serialization/ProjectSerializer.js";
import { OrmProject } from "../../src/model/OrmProject.js";

describe("ProjectSerializer", () => {
  const serializer = new ProjectSerializer();

  describe("serialize", () => {
    it("serializes a minimal project", () => {
      const project = new OrmProject({ name: "My Project" });
      const yaml = serializer.serialize(project);

      expect(yaml).toContain("name: My Project");
      expect(yaml).toContain("project:");
    });

    it("serializes domains", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({ path: "./crm.orm.yaml", context: "crm" });
      project.addDomain({
        path: "./billing.orm.yaml",
        context: "billing",
      });

      const yaml = serializer.serialize(project);
      expect(yaml).toContain("domains:");
      expect(yaml).toContain("crm");
      expect(yaml).toContain("billing");
    });

    it("serializes products with dependencies", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({ path: "./crm.orm.yaml", context: "crm" });
      project.addProduct({
        path: "./clv.orm.yaml",
        context: "clv",
        dependsOnDomains: ["crm"],
        dependsOnMappings: ["crm-billing"],
      });

      const yaml = serializer.serialize(project);
      expect(yaml).toContain("products:");
      expect(yaml).toContain("clv");
      expect(yaml).toContain("depends_on:");
    });
  });

  describe("deserialize", () => {
    it("deserializes a minimal project", () => {
      const yaml = `
project:
  name: "My Project"
`;
      const project = serializer.deserialize(yaml);
      expect(project.name).toBe("My Project");
      expect(project.domains).toHaveLength(0);
    });

    it("deserializes domains", () => {
      const yaml = `
project:
  name: "Test"
  domains:
    - path: "./crm.orm.yaml"
      context: "crm"
    - path: "./billing.orm.yaml"
      context: "billing"
`;
      const project = serializer.deserialize(yaml);
      expect(project.domains).toHaveLength(2);
      expect(project.getDomain("crm")!.path).toBe("./crm.orm.yaml");
    });

    it("deserializes products with dependencies", () => {
      const yaml = `
project:
  name: "Test"
  domains:
    - path: "./crm.orm.yaml"
      context: "crm"
  products:
    - path: "./clv.orm.yaml"
      context: "clv"
      depends_on:
        domains:
          - "crm"
        mappings:
          - "crm-billing"
`;
      const project = serializer.deserialize(yaml);
      expect(project.products).toHaveLength(1);
      expect(project.getProduct("clv")!.dependsOnDomains).toEqual([
        "crm",
      ]);
      expect(project.getProduct("clv")!.dependsOnMappings).toEqual([
        "crm-billing",
      ]);
    });

    it("throws on invalid YAML", () => {
      expect(() => serializer.deserialize("{{{{")).toThrow(
        ProjectDeserializationError,
      );
    });

    it("throws on schema validation failure", () => {
      expect(() =>
        serializer.deserialize("foo: bar"),
      ).toThrow(ProjectDeserializationError);
    });

    it("throws when project name is missing", () => {
      const yaml = `
project:
  domains: []
`;
      expect(() => serializer.deserialize(yaml)).toThrow(
        ProjectDeserializationError,
      );
    });
  });

  describe("round-trip", () => {
    it("round-trips a full project", () => {
      const original = new OrmProject({
        name: "Warehouse",
        domains: [
          { path: "./crm.orm.yaml", context: "crm" },
          { path: "./billing.orm.yaml", context: "billing" },
        ],
        products: [
          {
            path: "./clv.orm.yaml",
            context: "clv",
            dependsOnDomains: ["crm"],
            dependsOnMappings: [],
          },
        ],
      });

      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(yaml);

      expect(restored.name).toBe("Warehouse");
      expect(restored.domains).toHaveLength(2);
      expect(restored.products).toHaveLength(1);
      expect(restored.getDomain("crm")!.path).toBe("./crm.orm.yaml");
      expect(restored.getProduct("clv")!.dependsOnDomains).toEqual([
        "crm",
      ]);
    });
  });

  describe("settings", () => {
    it("serializes settings", () => {
      const project = new OrmProject({
        name: "EDPL",
        settings: {
          dbtProjectDir: "dbt",
          defaultExportFormat: "dbt",
          defaultExportDir: "dbt/models/staging",
        },
      });
      const yaml = serializer.serialize(project);

      expect(yaml).toContain("settings:");
      expect(yaml).toContain("dbt_project_dir: dbt");
      expect(yaml).toContain("default_export_format: dbt");
      expect(yaml).toContain("default_export_dir: dbt/models/staging");
    });

    it("omits settings when all values are undefined", () => {
      const project = new OrmProject({ name: "Minimal" });
      const yaml = serializer.serialize(project);
      expect(yaml).not.toContain("settings:");
    });

    it("deserializes settings", () => {
      const yaml = `
project:
  name: "EDPL"
  settings:
    dbt_project_dir: dbt
    default_export_format: dbt
    default_export_dir: dbt/models/staging
`;
      const project = serializer.deserialize(yaml);
      expect(project.settings.dbtProjectDir).toBe("dbt");
      expect(project.settings.defaultExportFormat).toBe("dbt");
      expect(project.settings.defaultExportDir).toBe("dbt/models/staging");
    });

    it("deserializes partial settings", () => {
      const yaml = `
project:
  name: "EDPL"
  settings:
    dbt_project_dir: dbt
`;
      const project = serializer.deserialize(yaml);
      expect(project.settings.dbtProjectDir).toBe("dbt");
      expect(project.settings.defaultExportFormat).toBeUndefined();
      expect(project.settings.defaultExportDir).toBeUndefined();
    });

    it("deserializes project without settings", () => {
      const yaml = `
project:
  name: "No Settings"
`;
      const project = serializer.deserialize(yaml);
      expect(project.settings).toEqual({});
    });

    it("round-trips settings", () => {
      const original = new OrmProject({
        name: "EDPL",
        settings: {
          dbtProjectDir: "dbt",
          defaultExportFormat: "avro",
        },
      });
      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(yaml);

      expect(restored.settings.dbtProjectDir).toBe("dbt");
      expect(restored.settings.defaultExportFormat).toBe("avro");
      expect(restored.settings.defaultExportDir).toBeUndefined();
    });

    it("round-trips a full project with settings", () => {
      const original = new OrmProject({
        name: "Warehouse",
        domains: [
          { path: "./crm.orm.yaml", context: "crm" },
        ],
        settings: {
          dbtProjectDir: "dbt",
          defaultExportFormat: "dbt",
          defaultExportDir: "dbt/models/staging",
        },
      });

      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(yaml);

      expect(restored.name).toBe("Warehouse");
      expect(restored.domains).toHaveLength(1);
      expect(restored.settings.dbtProjectDir).toBe("dbt");
      expect(restored.settings.defaultExportFormat).toBe("dbt");
      expect(restored.settings.defaultExportDir).toBe("dbt/models/staging");
    });

    it("rejects invalid export format", () => {
      const yaml = `
project:
  name: "Bad"
  settings:
    default_export_format: csv
`;
      expect(() => serializer.deserialize(yaml)).toThrow(
        ProjectDeserializationError,
      );
    });

    it("serializes preferred_identifier_strategy", () => {
      const project = new OrmProject({
        name: "EDPL",
        settings: {
          preferredIdentifierStrategy: "uuid",
        },
      });
      const yaml = serializer.serialize(project);

      expect(yaml).toContain("settings:");
      expect(yaml).toContain("preferred_identifier_strategy: uuid");
    });

    it("deserializes preferred_identifier_strategy", () => {
      const yaml = `
project:
  name: "EDPL"
  settings:
    preferred_identifier_strategy: integer
`;
      const project = serializer.deserialize(yaml);
      expect(project.settings.preferredIdentifierStrategy).toBe("integer");
    });

    it("round-trips preferred_identifier_strategy", () => {
      const original = new OrmProject({
        name: "EDPL",
        settings: {
          preferredIdentifierStrategy: "uuid",
        },
      });
      const yaml = serializer.serialize(original);
      const restored = serializer.deserialize(yaml);
      expect(restored.settings.preferredIdentifierStrategy).toBe("uuid");
    });

    it("rejects invalid preferred_identifier_strategy", () => {
      const yaml = `
project:
  name: "Bad"
  settings:
    preferred_identifier_strategy: serial
`;
      expect(() => serializer.deserialize(yaml)).toThrow(
        ProjectDeserializationError,
      );
    });
  });

  describe("getMappingPaths", () => {
    it("extracts mapping paths from YAML", () => {
      const yaml = `
project:
  name: "Test"
  mappings:
    - path: "./crm-billing.map.yaml"
    - path: "./billing-shipping.map.yaml"
`;
      const paths = serializer.getMappingPaths(yaml);
      expect(paths).toEqual([
        "./crm-billing.map.yaml",
        "./billing-shipping.map.yaml",
      ]);
    });

    it("returns empty for invalid YAML", () => {
      expect(serializer.getMappingPaths("{{{{")).toEqual([]);
    });
  });
});
