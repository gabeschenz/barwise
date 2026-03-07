/**
 * import_model tool: imports from structured formats (DDL, OpenAPI, etc.).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getImportFormat,
  DdlImportFormat,
  OpenApiImportFormat,
  registerImportFormat,
  OrmYamlSerializer,
} from "@barwise/core";
import { readSource } from "../helpers/resolve.js";

const serializer = new OrmYamlSerializer();

// Register built-in formats on module load
registerImportFormat(new DdlImportFormat());
registerImportFormat(new OpenApiImportFormat());

export function registerImportModelTool(server: McpServer): void {
  server.registerTool(
    "import_model",
    {
      title: "Import Model",
      description:
        "Import an ORM model from a structured format (DDL, OpenAPI, etc.). " +
        "Performs deterministic parsing to produce a draft ORM model. " +
        "The draft may need refinement but provides a useful starting point.",
      inputSchema: {
        source: z
          .string()
          .describe(
            "Source content (inline) or file path to DDL, OpenAPI spec, etc.",
          ),
        format: z
          .enum(["ddl", "openapi"])
          .describe(
            "Format of the source: 'ddl' for SQL DDL, 'openapi' for OpenAPI 3.x specs",
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
  format: "ddl" | "openapi",
  modelName?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  // Read source (file or inline)
  const input = readSource(source);

  // Get the import format
  const importFormat = getImportFormat(format);
  if (!importFormat) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: Unknown import format "${format}". Supported formats: ddl, openapi`,
        },
      ],
    };
  }

  // Parse the input
  const result = importFormat.parse(input, { modelName });

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
