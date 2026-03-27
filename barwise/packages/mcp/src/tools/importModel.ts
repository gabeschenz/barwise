/**
 * import_model tool: imports from structured formats (DDL, OpenAPI, dbt, etc.).
 */

import { getImporter, OrmYamlSerializer, registerBuiltinFormats } from "@barwise/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readSource } from "../helpers/resolve.js";

const serializer = new OrmYamlSerializer();

// Register built-in formats (DDL, OpenAPI, dbt, etc.) with the unified registry.
registerBuiltinFormats();

export function registerImportModelTool(server: McpServer): void {
  server.registerTool(
    "import_model",
    {
      title: "Import Model",
      description: "Import an ORM model from a structured format (DDL, OpenAPI, dbt, etc.). "
        + "Performs deterministic parsing to produce a draft ORM model. "
        + "For text formats (ddl, openapi), source is file content or a file path. "
        + "For directory formats (dbt), source is a directory path.",
      inputSchema: {
        source: z
          .string()
          .describe(
            "Source content (inline) or file/directory path. "
              + "For text formats: file content or path to file. "
              + "For directory formats (dbt): path to project directory.",
          ),
        format: z
          .enum(["ddl", "openapi", "dbt"])
          .describe(
            "Format of the source: 'ddl' for SQL DDL, 'openapi' for OpenAPI 3.x specs, "
              + "'dbt' for dbt project directory",
          ),
        modelName: z
          .string()
          .optional()
          .describe("Name for the resulting ORM model (defaults to format-specific)"),
      },
    },
    async ({ source, format, modelName }) => {
      return executeImportModel(source, format, modelName);
    },
  );
}

export async function executeImportModel(
  source: string,
  format: "ddl" | "openapi" | "dbt",
  modelName?: string,
): Promise<{ content: Array<{ type: "text"; text: string; }>; }> {
  // Get the importer from the unified registry
  const importFormat = getImporter(format);
  if (!importFormat) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Unknown import format "${format}". Supported formats: ddl, openapi, dbt`,
        },
      ],
    };
  }

  // Route based on input kind
  let result;
  if (importFormat.inputKind === "directory") {
    // Directory-based format: source is a path
    if (!importFormat.parseAsync) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Error: Format "${format}" is directory-based but does not support async parsing.`,
          },
        ],
      };
    }
    result = await importFormat.parseAsync(source, { modelName });
  } else {
    // Text-based format: source is file content or file path
    if (!importFormat.parse) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Format "${format}" does not support synchronous text parsing.`,
          },
        ],
      };
    }
    const input = readSource(source);
    result = importFormat.parse(input, { modelName });
  }

  // Serialize to YAML
  const yaml = serializer.serialize(result.model);

  // Format output with warnings
  let output = yaml;
  if (result.warnings.length > 0) {
    output += "\n\n# Import Warnings:\n";
    for (const warning of result.warnings) {
      output += `# - ${warning}\n`;
    }
  }

  output += `\n# Import confidence: ${result.confidence}\n`;
  output += `# Note: This is a draft model from ${format} import. Review and refine as needed.\n`;

  return {
    content: [{ type: "text" as const, text: output }],
  };
}
