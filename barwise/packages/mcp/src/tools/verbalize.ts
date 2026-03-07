/**
 * verbalize_model tool: generates FORML verbalizations for a model.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Verbalizer } from "@barwise/core";
import { resolveSource } from "../helpers/resolve.js";

export function registerVerbalizeTool(server: McpServer): void {
  server.registerTool(
    "verbalize_model",
    {
      title: "Verbalize ORM Model",
      description:
        "Generate FORML natural-language readings for fact types " +
        "and constraints in an ORM 2 model.",
      inputSchema: {
        source: z
          .string()
          .describe("File path to .orm.yaml or inline YAML content"),
        factType: z
          .string()
          .optional()
          .describe("Specific fact type name to verbalize (omit for all)"),
      },
    },
    async ({ source, factType }) => {
      return executeVerbalize(source, factType);
    },
  );
}

export function executeVerbalize(
  source: string,
  factType?: string,
): { content: Array<{ type: "text"; text: string }> } {
  const model = resolveSource(source);
  const verbalizer = new Verbalizer();

  if (factType) {
    const ft = model.getFactTypeByName(factType);
    if (!ft) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No fact type found matching "${factType}".`,
          },
        ],
      };
    }
    const verbalizations = verbalizer.verbalizeFactType(ft.id, model);
    const lines = verbalizations.map((v) => v.text);
    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  }

  const verbalizations = verbalizer.verbalizeModel(model);
  const lines = verbalizations.map((v) => v.text);
  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}
