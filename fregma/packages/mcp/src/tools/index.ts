/**
 * Tool registration barrel. Registers all MCP tools on the server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerValidateTool } from "./validate.js";
import { registerVerbalizeTool } from "./verbalize.js";
import { registerSchemaTool } from "./schema.js";
import { registerDiffTool } from "./diff.js";
import { registerDiagramTool } from "./diagram.js";
import { registerImportTool } from "./import.js";
import { registerMergeTool } from "./merge.js";

export function registerTools(server: McpServer): void {
  registerValidateTool(server);
  registerVerbalizeTool(server);
  registerSchemaTool(server);
  registerDiffTool(server);
  registerDiagramTool(server);
  registerImportTool(server);
  registerMergeTool(server);
}
