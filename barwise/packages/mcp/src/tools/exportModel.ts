/**
 * export_model tool: exports an ORM model to a specified format.
 */

import { getExporter, registerBuiltinFormats } from "@barwise/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveSource } from "../helpers/resolve.js";

// Register built-in formats (DDL, OpenAPI, etc.) with the unified registry.
registerBuiltinFormats();

export function registerExportModelTool(server: McpServer): void {
  server.registerTool(
    "export_model",
    {
      title: "Export ORM Model",
      description: "Export an ORM 2 model to a specified format (ddl, openapi, etc.). "
        + "Returns the exported artifact as text. Supports validation, annotations, "
        + "and format-specific options.",
      inputSchema: {
        source: z
          .string()
          .describe("File path to .orm.yaml or inline YAML content"),
        format: z
          .string()
          .describe(
            "Export format name (e.g., 'ddl', 'openapi'). Use list_formats to see available formats.",
          ),
        options: z
          .object({
            annotate: z
              .boolean()
              .optional()
              .describe(
                "Include TODO/NOTE annotations in output (default: true)",
              ),
            includeExamples: z
              .boolean()
              .optional()
              .describe("Include population examples in output (default: true)"),
            strict: z
              .boolean()
              .optional()
              .describe(
                "Refuse to export if model has validation errors (default: false)",
              ),
          })
          .catchall(z.unknown())
          .optional()
          .describe(
            "Export options. Format-specific options can be included (e.g., title, version for OpenAPI).",
          ),
      },
    },
    async ({ source, format, options }) => {
      return executeExportModel(source, format, options);
    },
  );
}

export function executeExportModel(
  source: string,
  format: string,
  options?: Record<string, unknown>,
): { content: Array<{ type: "text"; text: string; }>; } {
  const model = resolveSource(source);

  // Get the exporter from the unified registry.
  const exporter = getExporter(format);
  if (!exporter) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error:
                `Unknown export format: "${format}". Use list_formats to see available formats.`,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  try {
    // Export using the format adapter.
    const result = exporter.export(model, options);

    // Return the primary text output.
    // For multi-file formats, the text field contains a combined view.
    return {
      content: [{ type: "text" as const, text: result.text }],
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
