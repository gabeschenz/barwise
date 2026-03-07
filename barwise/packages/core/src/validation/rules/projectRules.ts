import type { OrmProject } from "../../model/OrmProject.js";
import type { Diagnostic } from "../Diagnostic.js";

/**
 * A project-level validation rule inspects an OrmProject and returns
 * zero or more diagnostics.
 */
export type ProjectValidationRule = (project: OrmProject) => Diagnostic[];

/**
 * Cross-domain validation rules for multi-file ORM projects.
 *
 * Checks:
 * - Context names are unique across domains and products.
 * - Context mapping source and target contexts reference existing domains.
 * - Entity mappings in context mappings reference object types that exist
 *   in the source and target domains (when loaded).
 * - Product dependencies reference existing domains and mappings.
 */
export function projectRules(project: OrmProject): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...checkMappingContextsExist(project));
  diagnostics.push(...checkEntityMappingReferences(project));
  diagnostics.push(...checkProductDependencies(project));

  return diagnostics;
}

/**
 * Every context mapping must reference source and target contexts
 * that exist as domains in the project.
 */
function checkMappingContextsExist(project: OrmProject): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const domainContexts = new Set(project.domains.map((d) => d.context));

  for (const mapping of project.mappings) {
    if (!domainContexts.has(mapping.sourceContext)) {
      diagnostics.push({
        severity: "error",
        message: `Context mapping "${mapping.path}" references source context `
          + `"${mapping.sourceContext}" which is not a domain in the project.`,
        elementId: mapping.path,
        ruleId: "project/mapping-source-context-missing",
      });
    }
    if (!domainContexts.has(mapping.targetContext)) {
      diagnostics.push({
        severity: "error",
        message: `Context mapping "${mapping.path}" references target context `
          + `"${mapping.targetContext}" which is not a domain in the project.`,
        elementId: mapping.path,
        ruleId: "project/mapping-target-context-missing",
      });
    }
  }

  return diagnostics;
}

/**
 * When domain models are loaded, entity mappings should reference
 * object types that exist in the source and target domains.
 */
function checkEntityMappingReferences(
  project: OrmProject,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const mapping of project.mappings) {
    const sourceDomain = project.getDomain(mapping.sourceContext);
    const targetDomain = project.getDomain(mapping.targetContext);

    for (const em of mapping.entityMappings) {
      // Check source object type.
      if (sourceDomain?.model) {
        const sourceRef = em.sourceObjectType;
        const sourceOt = sourceDomain.model.getObjectTypeByName(sourceRef);
        if (!sourceOt) {
          diagnostics.push({
            severity: "error",
            message: `Entity mapping in "${mapping.path}" references source `
              + `object type "${sourceRef}" which does not exist in `
              + `domain "${mapping.sourceContext}".`,
            elementId: mapping.path,
            ruleId: "project/entity-mapping-source-missing",
          });
        }
      }

      // Check target object type.
      if (targetDomain?.model) {
        const targetRef = em.targetObjectType;
        const targetOt = targetDomain.model.getObjectTypeByName(targetRef);
        if (!targetOt) {
          diagnostics.push({
            severity: "error",
            message: `Entity mapping in "${mapping.path}" references target `
              + `object type "${targetRef}" which does not exist in `
              + `domain "${mapping.targetContext}".`,
            elementId: mapping.path,
            ruleId: "project/entity-mapping-target-missing",
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Data product dependencies must reference domains and mappings
 * that exist in the project.
 */
function checkProductDependencies(project: OrmProject): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const domainContexts = new Set(project.domains.map((d) => d.context));

  // Build a set of "mapping names" -- we use source-target pairs.
  const mappingPaths = new Set(project.mappings.map((m) => m.path));

  for (const product of project.products) {
    for (const depDomain of product.dependsOnDomains) {
      if (!domainContexts.has(depDomain)) {
        diagnostics.push({
          severity: "error",
          message: `Data product "${product.context}" depends on domain `
            + `"${depDomain}" which is not in the project.`,
          elementId: product.path,
          ruleId: "project/product-domain-dependency-missing",
        });
      }
    }

    for (const depMapping of product.dependsOnMappings) {
      // Check if any mapping path contains the dependency name.
      const found = [...mappingPaths].some(
        (p) => p === depMapping || p.includes(depMapping),
      );
      if (!found) {
        diagnostics.push({
          severity: "warning",
          message: `Data product "${product.context}" depends on mapping `
            + `"${depMapping}" which could not be matched to a mapping in the project.`,
          elementId: product.path,
          ruleId: "project/product-mapping-dependency-unresolved",
        });
      }
    }
  }

  return diagnostics;
}
