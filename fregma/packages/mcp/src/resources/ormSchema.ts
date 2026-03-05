/**
 * orm-schema://json-schema resource: returns the ORM model JSON Schema.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ormModelSchema from "../../../core/schemas/orm-model.schema.json" with { type: "json" };

// Cache the stringified schema so it is only serialized once.
let schemaContent: string | undefined;

function loadSchema(): string {
  if (!schemaContent) {
    schemaContent = JSON.stringify(ormModelSchema, null, 2);
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
