/**
 * Prompt registration barrel. Registers all MCP prompts on the server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnalyzeDomainPrompt } from "./analyzeDomain.js";
import { registerReviewModelPrompt } from "./reviewModel.js";

export function registerPrompts(server: McpServer): void {
  registerAnalyzeDomainPrompt(server);
  registerReviewModelPrompt(server);
}
