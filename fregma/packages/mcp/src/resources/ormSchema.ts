/**
 * orm-schema://json-schema resource: returns the ORM model JSON Schema.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Resolve the schema file relative to @fregma/core's package location.
// We look for it via require.resolve-like traversal.
let schemaContent: string | undefined;

function loadSchema(): string {
  if (schemaContent) return schemaContent;

  // The schema lives in @fregma/core/schemas/orm-model.schema.json.
  // Since we're in a monorepo, resolve relative to this file's location.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = resolve(
    __dirname,
    "../../..",
    "core/schemas/orm-model.schema.json",
  );

  try {
    schemaContent = readFileSync(schemaPath, "utf-8");
  } catch {
    // Fallback: try the dist path (when running from built output).
    const distPath = resolve(
      __dirname,
      "../../../..",
      "core/schemas/orm-model.schema.json",
    );
    schemaContent = readFileSync(distPath, "utf-8");
  }

  return schemaContent;
}

export function registerOrmSchemaResource(server: McpServer): void {
  server.registerResource(
    "orm-json-schema",
    "orm-schema://json-schema",
    {
      title: "ORM Model JSON Schema",
      description:
        "The JSON Schema that defines the structure of .orm.yaml files. " +
        "Useful for understanding the model format and validating YAML content.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: loadSchema(),
        },
      ],
    }),
  );
}
