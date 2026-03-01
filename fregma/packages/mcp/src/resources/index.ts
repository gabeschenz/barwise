/**
 * Resource registration barrel. Registers all MCP resources on the server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrmSchemaResource } from "./ormSchema.js";
import { registerOrmModelResource } from "./ormModel.js";

export function registerResources(server: McpServer): void {
  registerOrmSchemaResource(server);
  registerOrmModelResource(server);
}
