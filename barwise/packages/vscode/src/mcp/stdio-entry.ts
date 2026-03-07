/**
 * Standalone MCP server entry point bundled into the VS Code extension.
 *
 * VS Code spawns this as a child process via McpStdioServerDefinition.
 * It imports the MCP server factory from @barwise/mcp and connects it
 * to a stdio transport. esbuild bundles all dependencies into a single
 * file at dist/mcp/index.js.
 */

import { createServer } from "@barwise/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
