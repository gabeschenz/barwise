/**
 * generate_schema tool: generates relational schema (DDL or JSON) from a model.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RelationalMapper, renderDdl } from "@fregma/core";
import { resolveSource } from "../helpers/resolve.js";

export function registerSchemaTool(server: McpServer): void {
  server.registerTool(
    "generate_schema",
    {
      title: "Generate Relational Schema",
      description:
        "Generate a relational schema (DDL or JSON) from an ORM 2 model. " +
        "Maps object types and fact types to tables, columns, and keys.",
      inputSchema: {
        source: z
          .string()
          .describe("File path to .orm.yaml or inline YAML content"),
        format: z
          .enum(["ddl", "json"])
          .default("ddl")
          .describe("Output format: DDL SQL or JSON mapping"),
      },
    },
    async ({ source, format }) => {
      return executeSchema(source, format);
    },
  );
}

export function executeSchema(
  source: string,
  format: "ddl" | "json" = "ddl",
): { content: Array<{ type: "text"; text: string }> } {
  const model = resolveSource(source);
  const mapper = new RelationalMapper();
  const schema = mapper.map(model);

  if (format === "json") {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(schema, null, 2) },
      ],
    };
  }

  const ddl = renderDdl(schema);
  return {
    content: [{ type: "text" as const, text: ddl }],
  };
}
