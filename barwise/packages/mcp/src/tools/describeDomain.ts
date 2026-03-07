/**
 * describe_domain tool: queries an ORM model for domain context.
 */

import { describeDomain } from "@barwise/core";
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
        + "on a specific entity, fact type, or constraint type.",
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
      },
    },
    async ({ source, focus, includePopulations }) => {
      return executeDescribeDomain(source, focus, includePopulations);
    },
  );
}

export function executeDescribeDomain(
  source: string,
  focus?: string,
  includePopulations?: boolean,
): { content: Array<{ type: "text"; text: string; }>; } {
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
