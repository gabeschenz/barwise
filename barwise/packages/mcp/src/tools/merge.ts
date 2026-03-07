/**
 * merge_models tool: merges an incoming model into a base model.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  diffModels,
  mergeAndValidate,
  OrmYamlSerializer,
} from "@barwise/core";
import type { Diagnostic } from "@barwise/core";
import { resolveSource } from "../helpers/resolve.js";

const serializer = new OrmYamlSerializer();

export function registerMergeTool(server: McpServer): void {
  server.registerTool(
    "merge_models",
    {
      title: "Merge ORM Models",
      description:
        "Merge an incoming ORM model into a base model. Accepts all " +
        "additions and modifications, rejects removals (non-interactive). " +
        "Returns the merged model as YAML with validation results.",
      inputSchema: {
        base: z
          .string()
          .describe("File path or inline YAML for the base model"),
        incoming: z
          .string()
          .describe("File path or inline YAML for the incoming model"),
      },
    },
    async ({ base, incoming }) => {
      return executeMerge(base, incoming);
    },
  );
}

export function executeMerge(
  base: string,
  incoming: string,
): { content: Array<{ type: "text"; text: string }> } {
  const baseModel = resolveSource(base);
  const incomingModel = resolveSource(incoming);

  // Compute diff and accept additions/modifications, reject removals.
  const diff = diffModels(baseModel, incomingModel);

  if (!diff.hasChanges) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              yaml: serializer.serialize(baseModel),
              valid: true,
              hasChanges: false,
              errorCount: 0,
              warningCount: 0,
              diagnostics: [],
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const accepted = new Set<number>();
  for (let i = 0; i < diff.deltas.length; i++) {
    const d = diff.deltas[i]!;
    if (d.kind === "added" || d.kind === "modified") {
      accepted.add(i);
    }
  }

  const mergeResult = mergeAndValidate(
    baseModel,
    incomingModel,
    diff.deltas,
    accepted,
  );

  const yaml = mergeResult.model
    ? serializer.serialize(mergeResult.model)
    : serializer.serialize(baseModel);

  // mergeResult.diagnostics contains only structural errors (severity "error").
  // getStructuralErrors filters out warnings intentionally -- a structurally
  // valid merge is safe to write to disk even with completeness warnings.
  const result = {
    yaml,
    valid: mergeResult.isValid,
    hasChanges: true,
    errorCount: mergeResult.diagnostics.length,
    diagnostics: mergeResult.diagnostics.map((d: Diagnostic) => ({
      severity: d.severity,
      ruleId: d.ruleId,
      message: d.message,
    })),
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}
