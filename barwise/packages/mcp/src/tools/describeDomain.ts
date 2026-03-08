/**
 * describe_domain tool: queries an ORM model for domain context.
 *
 * Supports two modes:
 * 1. Standard: pass a source .orm.yaml file path or inline YAML
 * 2. Lineage: pass a filePath to a generated artifact (e.g. DDL file),
 *    and the tool resolves through the lineage manifest to find the
 *    source model and relevant ORM elements.
 */

import { describeDomain, findOrmModel, resolveArtifact } from "@barwise/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveSource } from "../helpers/resolve.js";

export function registerDescribeDomainTool(server: McpServer): void {
  server.registerTool(
    "describe_domain",
    {
      title: "Describe Domain",
      description: "Query the formal domain model for entity definitions, constraints, "
        + "relationships, and business rules. Use this before generating database "
        + "schemas, API code, or data models to ensure correctness. Optionally focus "
        + "on a specific entity, fact type, or constraint type. Can also accept a "
        + "generated artifact path (e.g., DDL file) and resolve back to the source "
        + "model through lineage.",
      inputSchema: {
        source: z
          .string()
          .describe("File path to .orm.yaml or inline YAML content"),
        focus: z
          .string()
          .optional()
          .describe(
            "Optional focus: entity name, fact type name, or constraint type keyword "
              + "(e.g., 'Patient', 'mandatory', 'uniqueness'). Omit for full summary.",
          ),
        includePopulations: z
          .boolean()
          .optional()
          .describe(
            "Include population (example) data in the description (default: true)",
          ),
        filePath: z
          .string()
          .optional()
          .describe(
            "Path to a generated artifact (e.g., DDL file). When provided, resolves "
              + "through the lineage manifest to find the source ORM model and focuses "
              + "on the elements that produced the artifact. Overrides 'source'.",
          ),
      },
    },
    async ({ source, focus, includePopulations, filePath }) => {
      return executeDescribeDomain(source, focus, includePopulations, filePath);
    },
  );
}

export function executeDescribeDomain(
  source: string,
  focus?: string,
  includePopulations?: boolean,
  filePath?: string,
): { content: Array<{ type: "text"; text: string; }>; } {
  // If filePath is provided, resolve through lineage manifest.
  if (filePath) {
    return executeWithLineage(filePath, focus, includePopulations);
  }

  const model = resolveSource(source);

  try {
    const description = describeDomain(model, {
      focus,
      includePopulations,
    });

    // Return a structured JSON representation.
    // The summary is a human-readable string, and the other fields provide
    // structured data for programmatic access.
    const result = {
      summary: description.summary,
      entities: description.entityTypes.map((e) => ({
        name: e.name,
        definition: e.definition,
        kind: e.kind,
        referenceMode: e.referenceMode,
      })),
      factTypes: description.factTypes.map((ft) => ({
        name: ft.name,
        arity: ft.arity,
        primaryReading: ft.primaryReading,
        involvedEntities: ft.involvedEntities,
        constraintCount: ft.constraintCount,
      })),
      constraints: description.constraints.map((c) => ({
        type: c.type,
        verbalization: c.verbalization,
        affectedFactType: c.affectedFactType,
      })),
      ...(description.populations && {
        populations: description.populations.map((p) => ({
          factTypeName: p.factTypeName,
          description: p.description,
          instanceCount: p.instanceCount,
          sampleInstances: p.sampleInstances.slice(0, 3), // Limit to 3 for brevity
        })),
      }),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Execute describe_domain by resolving a generated artifact path through
 * the lineage manifest to find the source model and relevant elements.
 */
function executeWithLineage(
  filePath: string,
  focus?: string,
  includePopulations?: boolean,
): { content: Array<{ type: "text"; text: string; }>; } {
  const resolution = resolveArtifact(filePath);

  if (!resolution) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: `No lineage manifest found for artifact: ${filePath}. `
                + "Export the model with 'barwise export --output <path>' first to create a manifest.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  // Find and load the source ORM model.
  const modelPath = findOrmModel(resolution.manifestDir, resolution.sourceModel);
  if (!modelPath) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error:
                `Lineage manifest found but source model not located in ${resolution.manifestDir}.`,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const model = resolveSource(modelPath);

  // Use the source references from the manifest to focus the description.
  // Extract entity names from the source references to use as focus hints.
  const entityNames = resolution.sources
    .filter((s) => s.elementType === "EntityType")
    .map((s) => s.elementName);

  // If there's exactly one entity source and no explicit focus, use it as focus.
  const effectiveFocus = focus
    ?? (entityNames.length === 1 ? entityNames[0] : undefined);

  try {
    const description = describeDomain(model, {
      focus: effectiveFocus,
      includePopulations,
    });

    const result = {
      summary: description.summary,
      lineage: {
        artifact: resolution.exportEntry.artifact,
        format: resolution.exportEntry.format,
        exportedAt: resolution.exportEntry.exportedAt,
        sourceElements: resolution.sources.map((s) => ({
          elementId: s.elementId,
          elementType: s.elementType,
          elementName: s.elementName,
        })),
      },
      entities: description.entityTypes.map((e) => ({
        name: e.name,
        definition: e.definition,
        kind: e.kind,
        referenceMode: e.referenceMode,
      })),
      factTypes: description.factTypes.map((ft) => ({
        name: ft.name,
        arity: ft.arity,
        primaryReading: ft.primaryReading,
        involvedEntities: ft.involvedEntities,
        constraintCount: ft.constraintCount,
      })),
      constraints: description.constraints.map((c) => ({
        type: c.type,
        verbalization: c.verbalization,
        affectedFactType: c.affectedFactType,
      })),
      ...(description.populations && {
        populations: description.populations.map((p) => ({
          factTypeName: p.factTypeName,
          description: p.description,
          instanceCount: p.instanceCount,
          sampleInstances: p.sampleInstances.slice(0, 3),
        })),
      }),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
