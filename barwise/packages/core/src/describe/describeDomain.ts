/**
 * Domain description functionality.
 *
 * Provides structured context about an ORM model to support AI-assisted
 * development and human review. Includes entity summaries, fact type
 * readings, constraints, and optional population data.
 */

import type { FactType } from "../model/FactType.js";
import type { ObjectType } from "../model/ObjectType.js";
import type { OrmModel } from "../model/OrmModel.js";
import type { FactInstance, Population } from "../model/Population.js";
import { Verbalizer } from "../verbalization/Verbalizer.js";

/**
 * Options for describing a domain.
 */
export interface DescribeDomainOptions {
  /**
   * Optional focus: entity name, fact type name, constraint type, or undefined
   * for full summary.
   */
  readonly focus?: string;

  /**
   * Include population data in the description (default: true).
   */
  readonly includePopulations?: boolean;
}

/**
 * Summary of an entity type (object type).
 */
export interface EntitySummary {
  readonly id: string;
  readonly name: string;
  readonly definition?: string;
  readonly kind: "entity" | "value";
  readonly referenceMode?: string;
}

/**
 * Summary of a fact type.
 */
export interface FactTypeSummary {
  readonly id: string;
  readonly name: string;
  readonly arity: number;
  readonly primaryReading: string;
  readonly involvedEntities: readonly string[]; // Entity names
  readonly constraintCount: number;
}

/**
 * Summary of a constraint.
 */
export interface ConstraintSummary {
  readonly id: string;
  readonly type: string;
  readonly verbalization: string;
  readonly affectedFactType: string; // Fact type name
}

/**
 * Summary of population data for a fact type.
 */
export interface PopulationSummary {
  readonly factTypeId: string;
  readonly factTypeName: string;
  readonly description?: string;
  readonly instanceCount: number;
  readonly sampleInstances: readonly FactInstance[];
}

/**
 * Complete domain description.
 */
export interface DomainDescription {
  readonly summary: string; // Human-readable summary
  readonly entityTypes: readonly EntitySummary[];
  readonly factTypes: readonly FactTypeSummary[];
  readonly constraints: readonly ConstraintSummary[];
  readonly populations?: readonly PopulationSummary[];
}

/**
 * Describe a domain model with optional focus.
 *
 * @param model - The ORM model to describe.
 * @param options - Focus and population options.
 * @returns Structured domain description.
 */
export function describeDomain(
  model: OrmModel,
  options: DescribeDomainOptions = {},
): DomainDescription {
  const focus = options.focus?.toLowerCase();
  const includePopulations = options.includePopulations ?? true;

  // If no focus, return full summary.
  if (!focus) {
    return describeFullModel(model, includePopulations);
  }

  // Try to match focus to an entity name.
  const entityMatch = model.objectTypes.find(
    (ot) => ot.name.toLowerCase() === focus,
  );
  if (entityMatch) {
    return describeEntity(model, entityMatch, includePopulations);
  }

  // Try to match focus to a fact type name.
  const factTypeMatch = model.factTypes.find(
    (ft) => ft.name.toLowerCase() === focus,
  );
  if (factTypeMatch) {
    return describeFactType(model, factTypeMatch, includePopulations);
  }

  // Try to match focus to a constraint type keyword.
  if (isConstraintTypeKeyword(focus)) {
    return describeConstraintType(model, focus, includePopulations);
  }

  // No match - return empty description with a message.
  return {
    summary:
      `No matching entity, fact type, or constraint type found for focus: "${options.focus}"`,
    entityTypes: [],
    factTypes: [],
    constraints: [],
    populations: includePopulations ? [] : undefined,
  };
}

/**
 * Describe the full model without focus.
 */
function describeFullModel(
  model: OrmModel,
  includePopulations: boolean,
): DomainDescription {
  const entitySummaries = model.objectTypes.map(summarizeEntity);
  const factTypeSummaries = model.factTypes.map((ft) => summarizeFactType(model, ft));

  const verbalizer = new Verbalizer();
  const constraintSummaries: ConstraintSummary[] = [];
  for (const ft of model.factTypes) {
    for (let i = 0; i < ft.constraints.length; i++) {
      const c = ft.constraints[i]!;
      const v = verbalizer.constraints.verbalize(c, ft, model);
      constraintSummaries.push({
        id: `${ft.id}-constraint-${i}`, // Generate ID from fact type + index
        type: c.type, // Use constraint type, not verbalization category
        verbalization: v.text,
        affectedFactType: ft.name,
      });
    }
  }

  const populationSummaries = includePopulations
    ? model.populations.map((p) => summarizePopulation(model, p))
    : undefined;

  const summary = buildFullSummary(
    model,
    entitySummaries,
    factTypeSummaries,
    constraintSummaries,
    populationSummaries,
  );

  return {
    summary,
    entityTypes: entitySummaries,
    factTypes: factTypeSummaries,
    constraints: constraintSummaries,
    populations: populationSummaries,
  };
}

/**
 * Describe a single entity and related elements.
 */
function describeEntity(
  model: OrmModel,
  entity: ObjectType,
  includePopulations: boolean,
): DomainDescription {
  const entitySummary = summarizeEntity(entity);

  // Find all fact types involving this entity.
  const relatedFactTypes = model.factTypes.filter((ft) =>
    ft.roles.some((r) => r.playerId === entity.id)
  );

  const factTypeSummaries = relatedFactTypes.map((ft) => summarizeFactType(model, ft));

  // Find all constraints on those fact types.
  const verbalizer = new Verbalizer();
  const constraintSummaries: ConstraintSummary[] = [];
  for (const ft of relatedFactTypes) {
    for (let i = 0; i < ft.constraints.length; i++) {
      const c = ft.constraints[i]!;
      const v = verbalizer.constraints.verbalize(c, ft, model);
      constraintSummaries.push({
        id: `${ft.id}-constraint-${i}`,
        type: c.type,
        verbalization: v.text,
        affectedFactType: ft.name,
      });
    }
  }

  // Find populations for related fact types.
  const populationSummaries = includePopulations
    ? model.populations
      .filter((p) => relatedFactTypes.some((ft) => ft.id === p.factTypeId))
      .map((p) => summarizePopulation(model, p))
    : undefined;

  const summary = buildEntityFocusSummary(
    entity,
    factTypeSummaries,
    constraintSummaries,
    populationSummaries,
  );

  return {
    summary,
    entityTypes: [entitySummary],
    factTypes: factTypeSummaries,
    constraints: constraintSummaries,
    populations: populationSummaries,
  };
}

/**
 * Describe a single fact type and related elements.
 */
function describeFactType(
  model: OrmModel,
  factType: FactType,
  includePopulations: boolean,
): DomainDescription {
  const factTypeSummary = summarizeFactType(model, factType);

  // Find all entities involved in this fact type.
  const involvedEntities = factType.roles
    .map((r) => model.getObjectType(r.playerId))
    .filter((ot): ot is ObjectType => ot !== undefined);

  const entitySummaries = involvedEntities.map(summarizeEntity);

  // Get constraint verbalizations for this fact type.
  const verbalizer = new Verbalizer();
  const constraintSummaries: ConstraintSummary[] = factType.constraints.map(
    (c, i) => {
      const v = verbalizer.constraints.verbalize(c, factType, model);
      return {
        id: `${factType.id}-constraint-${i}`,
        type: c.type,
        verbalization: v.text,
        affectedFactType: factType.name,
      };
    },
  );

  // Find populations for this fact type.
  const populationSummaries = includePopulations
    ? model.populations
      .filter((p) => p.factTypeId === factType.id)
      .map((p) => summarizePopulation(model, p))
    : undefined;

  const summary = buildFactTypeFocusSummary(
    factType,
    involvedEntities,
    constraintSummaries,
    populationSummaries,
  );

  return {
    summary,
    entityTypes: entitySummaries,
    factTypes: [factTypeSummary],
    constraints: constraintSummaries,
    populations: populationSummaries,
  };
}

/**
 * Describe all constraints of a specific type.
 */
function describeConstraintType(
  model: OrmModel,
  constraintTypeKeyword: string,
  includePopulations: boolean,
): DomainDescription {
  const verbalizer = new Verbalizer();
  const constraintSummaries: ConstraintSummary[] = [];
  const relatedFactTypes: FactType[] = [];

  for (const ft of model.factTypes) {
    for (let i = 0; i < ft.constraints.length; i++) {
      const c = ft.constraints[i]!;
      if (matchesConstraintType(c.type, constraintTypeKeyword)) {
        const v = verbalizer.constraints.verbalize(c, ft, model);
        constraintSummaries.push({
          id: `${ft.id}-constraint-${i}`,
          type: c.type,
          verbalization: v.text,
          affectedFactType: ft.name,
        });
        if (!relatedFactTypes.some((f) => f.id === ft.id)) {
          relatedFactTypes.push(ft);
        }
      }
    }
  }

  const factTypeSummaries = relatedFactTypes.map((ft) => summarizeFactType(model, ft));

  // Get entities involved in related fact types.
  const involvedEntityIds = new Set<string>();
  for (const ft of relatedFactTypes) {
    for (const role of ft.roles) {
      involvedEntityIds.add(role.playerId);
    }
  }

  const entitySummaries = Array.from(involvedEntityIds)
    .map((id) => model.getObjectType(id))
    .filter((ot): ot is ObjectType => ot !== undefined)
    .map(summarizeEntity);

  const populationSummaries = includePopulations
    ? model.populations
      .filter((p) => relatedFactTypes.some((ft) => ft.id === p.factTypeId))
      .map((p) => summarizePopulation(model, p))
    : undefined;

  const summary = buildConstraintTypeFocusSummary(
    constraintTypeKeyword,
    constraintSummaries,
  );

  return {
    summary,
    entityTypes: entitySummaries,
    factTypes: factTypeSummaries,
    constraints: constraintSummaries,
    populations: populationSummaries,
  };
}

/**
 * Summarize an entity type.
 */
function summarizeEntity(entity: ObjectType): EntitySummary {
  return {
    id: entity.id,
    name: entity.name,
    definition: entity.definition,
    kind: entity.kind,
    referenceMode: entity.referenceMode,
  };
}

/**
 * Summarize a fact type.
 */
function summarizeFactType(
  model: OrmModel,
  factType: FactType,
): FactTypeSummary {
  const verbalizer = new Verbalizer();
  const primaryVerbalization = verbalizer.factTypes.verbalizePrimary(
    factType,
    model,
  );
  const primaryReading = primaryVerbalization.text;

  const involvedEntities = factType.roles
    .map((r) => {
      const ot = model.getObjectType(r.playerId);
      return ot?.name ?? r.playerId;
    })
    .filter((name, idx, arr) => arr.indexOf(name) === idx); // unique

  return {
    id: factType.id,
    name: factType.name,
    arity: factType.roles.length,
    primaryReading,
    involvedEntities,
    constraintCount: factType.constraints.length,
  };
}

/**
 * Summarize a population.
 */
function summarizePopulation(
  model: OrmModel,
  population: Population,
): PopulationSummary {
  const factType = model.getFactType(population.factTypeId);
  const factTypeName = factType?.name ?? population.factTypeId;

  // Limit sample instances to 5 for brevity.
  const sampleInstances = population.instances.slice(0, 5);

  return {
    factTypeId: population.factTypeId,
    factTypeName,
    description: population.description,
    instanceCount: population.instances.length,
    sampleInstances,
  };
}

/**
 * Build a human-readable summary for the full model.
 */
function buildFullSummary(
  model: OrmModel,
  entities: readonly EntitySummary[],
  factTypes: readonly FactTypeSummary[],
  constraints: readonly ConstraintSummary[],
  populations: readonly PopulationSummary[] | undefined,
): string {
  const parts: string[] = [];

  parts.push(`Domain Model: ${model.name}`);
  if (model.domainContext) {
    parts.push(`Context: ${model.domainContext}`);
  }

  parts.push(`\nEntities: ${entities.length}`);
  parts.push(`Fact Types: ${factTypes.length}`);
  parts.push(`Constraints: ${constraints.length}`);

  if (populations && populations.length > 0) {
    const totalInstances = populations.reduce(
      (sum, p) => sum + p.instanceCount,
      0,
    );
    parts.push(`Populations: ${populations.length} (${totalInstances} instances)`);
  }

  parts.push("\nKey Entities:");
  for (const e of entities.slice(0, 10)) {
    // Show first 10
    const defPart = e.definition ? ` - ${e.definition}` : "";
    parts.push(`  - ${e.name}${defPart}`);
  }

  if (entities.length > 10) {
    parts.push(`  ... and ${entities.length - 10} more`);
  }

  return parts.join("\n");
}

/**
 * Build a human-readable summary for entity focus.
 */
function buildEntityFocusSummary(
  entity: ObjectType,
  factTypes: readonly FactTypeSummary[],
  constraints: readonly ConstraintSummary[],
  populations: readonly PopulationSummary[] | undefined,
): string {
  const parts: string[] = [];

  parts.push(`Entity: ${entity.name}`);
  if (entity.definition) {
    parts.push(`Definition: ${entity.definition}`);
  }
  parts.push(`Kind: ${entity.kind}`);
  if (entity.referenceMode) {
    parts.push(`Reference Mode: ${entity.referenceMode}`);
  }

  parts.push(`\nRelated Fact Types: ${factTypes.length}`);
  for (const ft of factTypes) {
    parts.push(`  - ${ft.primaryReading}`);
  }

  parts.push(`\nConstraints: ${constraints.length}`);
  for (const c of constraints.slice(0, 10)) {
    // Show first 10
    parts.push(`  - ${c.verbalization}`);
  }

  if (constraints.length > 10) {
    parts.push(`  ... and ${constraints.length - 10} more`);
  }

  if (populations && populations.length > 0) {
    parts.push(`\nPopulations: ${populations.length}`);
    for (const p of populations) {
      parts.push(`  - ${p.factTypeName}: ${p.instanceCount} instances`);
    }
  }

  return parts.join("\n");
}

/**
 * Build a human-readable summary for fact type focus.
 */
function buildFactTypeFocusSummary(
  factType: FactType,
  entities: readonly ObjectType[],
  constraints: readonly ConstraintSummary[],
  populations: readonly PopulationSummary[] | undefined,
): string {
  const parts: string[] = [];

  parts.push(`Fact Type: ${factType.name}`);
  parts.push(`Arity: ${factType.roles.length}`);

  parts.push(`\nRoles:`);
  for (const role of factType.roles) {
    const entity = entities.find((e) => e.id === role.playerId);
    const entityName = entity?.name ?? role.playerId;
    parts.push(`  - ${role.name} (played by ${entityName})`);
  }

  parts.push(`\nConstraints: ${constraints.length}`);
  for (const c of constraints) {
    parts.push(`  - ${c.verbalization}`);
  }

  if (populations && populations.length > 0) {
    parts.push(`\nPopulation Examples:`);
    for (const p of populations) {
      parts.push(`  Description: ${p.description ?? "Sample data"}`);
      parts.push(`  Instances: ${p.instanceCount}`);
      if (p.sampleInstances.length > 0) {
        parts.push(`  Sample:`);
        for (const inst of p.sampleInstances.slice(0, 3)) {
          const values = Object.entries(inst.roleValues)
            .map(([roleId, value]) => `${roleId}=${value}`)
            .join(", ");
          parts.push(`    - { ${values} }`);
        }
      }
    }
  }

  return parts.join("\n");
}

/**
 * Build a human-readable summary for constraint type focus.
 */
function buildConstraintTypeFocusSummary(
  constraintType: string,
  constraints: readonly ConstraintSummary[],
): string {
  const parts: string[] = [];

  parts.push(`Constraint Type: ${constraintType}`);
  parts.push(`Total Constraints: ${constraints.length}`);

  parts.push(`\nConstraints:`);
  for (const c of constraints) {
    parts.push(`  - [${c.affectedFactType}] ${c.verbalization}`);
  }

  return parts.join("\n");
}

/**
 * Check if a string is a constraint type keyword.
 */
function isConstraintTypeKeyword(keyword: string): boolean {
  const types = [
    "uniqueness",
    "mandatory",
    "value",
    "frequency",
    "exclusion",
    "subset",
    "equality",
    "ring",
    "disjunctive",
    "exclusive-or",
  ];
  return types.includes(keyword);
}

/**
 * Check if a verbalization type matches a constraint type keyword.
 */
function matchesConstraintType(
  verbalizationType: string | undefined,
  keyword: string,
): boolean {
  if (!verbalizationType) return false;
  const normalized = verbalizationType.toLowerCase();
  const keywordNormalized = keyword.toLowerCase();

  // Direct match.
  if (normalized === keywordNormalized) return true;

  // Handle variations.
  if (keywordNormalized === "uniqueness" && normalized.includes("uniqueness")) {
    return true;
  }
  if (keywordNormalized === "mandatory" && normalized.includes("mandatory")) {
    return true;
  }
  if (keywordNormalized === "value" && normalized.includes("value")) {
    return true;
  }
  if (keywordNormalized === "frequency" && normalized.includes("frequency")) {
    return true;
  }
  if (keywordNormalized === "exclusion" && normalized.includes("exclusion")) {
    return true;
  }
  if (keywordNormalized === "subset" && normalized.includes("subset")) {
    return true;
  }
  if (keywordNormalized === "equality" && normalized.includes("equality")) {
    return true;
  }
  if (keywordNormalized === "ring" && normalized.includes("ring")) return true;
  if (
    keywordNormalized === "disjunctive"
    && normalized.includes("disjunctive")
  ) {
    return true;
  }
  if (
    keywordNormalized === "exclusive-or"
    && normalized.includes("exclusive")
  ) {
    return true;
  }

  return false;
}
