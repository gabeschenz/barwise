/**
 * lineage_status tool: check staleness of exported artifacts.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkStaleness } from "@barwise/core";
import { resolveSource } from "../helpers/resolve.js";
import { dirname, resolve } from "node:path";

export function registerLineageStatusTool(server: McpServer): void {
  server.registerTool(
    "lineage_status",
    {
      title: "Check Lineage Status",
      description:
        "Check staleness of exported artifacts by comparing current model against lineage manifest. " +
        "Returns which artifacts are stale (out of date) vs fresh (up to date).",
      inputSchema: {
        source: z
          .string()
          .describe(
            "File path to .orm.yaml (needed to find project directory and model)",
          ),
      },
    },
    async ({ source }) => {
      return executeLineageStatus(source);
    },
  );
}

export function executeLineageStatus(
  source: string,
): { content: Array<{ type: "text"; text: string }> } {
  const model = resolveSource(source);

  // Determine the directory for manifest lookup
  // If source looks like a file path, use its directory
  // Otherwise use current working directory
  let dir: string;
  if (!source.includes("\n") && (source.endsWith(".yaml") || source.endsWith(".yml"))) {
    dir = dirname(resolve(source));
  } else {
    dir = process.cwd();
  }

  const report = checkStaleness(dir, model);

  return {
    content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }],
  };
}
