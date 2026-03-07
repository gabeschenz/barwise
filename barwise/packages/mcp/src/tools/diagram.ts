/**
 * generate_diagram tool: generates an SVG diagram from a model.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateDiagram } from "@barwise/diagram";
import { resolveSource } from "../helpers/resolve.js";

export function registerDiagramTool(server: McpServer): void {
  server.registerTool(
    "generate_diagram",
    {
      title: "Generate ORM Diagram",
      description:
        "DEPRECATED: Use export_model with format='svg' instead. This tool will be removed in a future version. " +
        "Generate an SVG diagram from an ORM 2 model. " +
        "Returns the SVG markup as text.",
      inputSchema: {
        source: z
          .string()
          .describe("File path to .orm.yaml or inline YAML content"),
      },
    },
    async ({ source }) => {
      return executeDiagram(source);
    },
  );
}

export async function executeDiagram(
  source: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const model = resolveSource(source);
  const result = await generateDiagram(model);

  return {
    content: [{ type: "text" as const, text: result.svg }],
  };
}
