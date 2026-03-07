/**
 * Tests for project-level validation rules.
 *
 * Project rules validate cross-domain consistency within an OrmProject:
 *   - Mapping context references: source/target contexts must exist as domains
 *   - Entity mapping references: mapped object type names must exist in
 *     the corresponding domain's loaded model
 *   - Product dependencies: a product's declared domain and mapping
 *     dependencies must be resolvable within the project
 */
import { describe, expect, it } from "vitest";
import { OrmModel } from "../../src/model/OrmModel.js";
import { OrmProject } from "../../src/model/OrmProject.js";
import { projectRules } from "../../src/validation/rules/projectRules.js";

describe("projectRules", () => {
  it("produces no diagnostics for a valid project", () => {
    const project = new OrmProject({ name: "Test" });
    const crmDomain = project.addDomain({
      path: "./crm.orm.yaml",
      context: "crm",
    });
    const billingDomain = project.addDomain({
      path: "./billing.orm.yaml",
      context: "billing",
    });

    // Load models.
    const crmModel = new OrmModel({ name: "CRM" });
    crmModel.addObjectType({
      name: "Customer",
      kind: "entity",
      referenceMode: "customer_id",
    });
    crmDomain.setModel(crmModel);

    const billingModel = new OrmModel({ name: "Billing" });
    billingModel.addObjectType({
      name: "Account",
      kind: "entity",
      referenceMode: "account_id",
    });
    billingDomain.setModel(billingModel);

    project.addMapping({
      path: "./crm-billing.map.yaml",
      sourceContext: "crm",
      targetContext: "billing",
      pattern: "shared_kernel",
      entityMappings: [
        {
          sourceObjectType: "Customer",
          targetObjectType: "Account",
        },
      ],
    });

    const diagnostics = projectRules(project);
    expect(diagnostics).toHaveLength(0);
  });

  it("produces no diagnostics for an empty project", () => {
    const project = new OrmProject({ name: "Empty" });
    expect(projectRules(project)).toHaveLength(0);
  });

  describe("mapping context references", () => {
    it("detects missing source context", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({
        path: "./billing.orm.yaml",
        context: "billing",
      });
      project.addMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
      });

      const diagnostics = projectRules(project);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "project/mapping-source-context-missing",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain("crm");
    });

    it("detects missing target context", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({ path: "./crm.orm.yaml", context: "crm" });
      project.addMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
      });

      const diagnostics = projectRules(project);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "project/mapping-target-context-missing",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain("billing");
    });
  });

  describe("entity mapping references", () => {
    it("detects missing source object type", () => {
      const project = new OrmProject({ name: "Test" });
      const crmDomain = project.addDomain({
        path: "./crm.orm.yaml",
        context: "crm",
      });
      const billingDomain = project.addDomain({
        path: "./billing.orm.yaml",
        context: "billing",
      });

      const crmModel = new OrmModel({ name: "CRM" });
      // No Customer object type.
      crmDomain.setModel(crmModel);

      const billingModel = new OrmModel({ name: "Billing" });
      billingModel.addObjectType({
        name: "Account",
        kind: "entity",
        referenceMode: "account_id",
      });
      billingDomain.setModel(billingModel);

      project.addMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
        entityMappings: [
          {
            sourceObjectType: "Customer",
            targetObjectType: "Account",
          },
        ],
      });

      const diagnostics = projectRules(project);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "project/entity-mapping-source-missing",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain("Customer");
    });

    it("detects missing target object type", () => {
      const project = new OrmProject({ name: "Test" });
      const crmDomain = project.addDomain({
        path: "./crm.orm.yaml",
        context: "crm",
      });
      const billingDomain = project.addDomain({
        path: "./billing.orm.yaml",
        context: "billing",
      });

      const crmModel = new OrmModel({ name: "CRM" });
      crmModel.addObjectType({
        name: "Customer",
        kind: "entity",
        referenceMode: "customer_id",
      });
      crmDomain.setModel(crmModel);

      const billingModel = new OrmModel({ name: "Billing" });
      // No Account object type.
      billingDomain.setModel(billingModel);

      project.addMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
        entityMappings: [
          {
            sourceObjectType: "Customer",
            targetObjectType: "Account",
          },
        ],
      });

      const diagnostics = projectRules(project);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "project/entity-mapping-target-missing",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain("Account");
    });

    it("skips check when domain model is not loaded", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({ path: "./crm.orm.yaml", context: "crm" });
      project.addDomain({
        path: "./billing.orm.yaml",
        context: "billing",
      });

      project.addMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
        entityMappings: [
          {
            sourceObjectType: "Customer",
            targetObjectType: "Account",
          },
        ],
      });

      const diagnostics = projectRules(project);
      // No entity mapping errors because models aren't loaded.
      const entityErrors = diagnostics.filter((d) => d.ruleId.includes("entity-mapping"));
      expect(entityErrors).toHaveLength(0);
    });
  });

  describe("product dependencies", () => {
    it("detects missing domain dependency", () => {
      const project = new OrmProject({ name: "Test" });
      project.addProduct({
        path: "./clv.orm.yaml",
        context: "clv",
        dependsOnDomains: ["crm", "billing"],
        dependsOnMappings: [],
      });

      const diagnostics = projectRules(project);
      const errors = diagnostics.filter(
        (d) => d.ruleId === "project/product-domain-dependency-missing",
      );
      expect(errors).toHaveLength(2);
    });

    it("warns on unresolvable mapping dependency", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({ path: "./crm.orm.yaml", context: "crm" });
      project.addProduct({
        path: "./clv.orm.yaml",
        context: "clv",
        dependsOnDomains: ["crm"],
        dependsOnMappings: ["nonexistent"],
      });

      const diagnostics = projectRules(project);
      const warnings = diagnostics.filter(
        (d) => d.ruleId === "project/product-mapping-dependency-unresolved",
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe("warning");
    });

    it("passes when all dependencies exist", () => {
      const project = new OrmProject({ name: "Test" });
      project.addDomain({ path: "./crm.orm.yaml", context: "crm" });
      project.addDomain({
        path: "./billing.orm.yaml",
        context: "billing",
      });
      project.addMapping({
        path: "./crm-billing.map.yaml",
        sourceContext: "crm",
        targetContext: "billing",
        pattern: "shared_kernel",
      });
      project.addProduct({
        path: "./clv.orm.yaml",
        context: "clv",
        dependsOnDomains: ["crm"],
        dependsOnMappings: ["crm-billing.map.yaml"],
      });

      const diagnostics = projectRules(project);
      const depErrors = diagnostics.filter(
        (d) =>
          d.ruleId === "project/product-domain-dependency-missing"
          || d.ruleId === "project/product-mapping-dependency-unresolved",
      );
      expect(depErrors).toHaveLength(0);
    });
  });
});
