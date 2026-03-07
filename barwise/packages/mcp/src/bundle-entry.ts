/**
 * Bundle entry point for npx / standalone usage.
 *
 * Wraps the top-level await in a main() function so that esbuild can
 * produce a CJS bundle (the yaml and other dependencies use CJS
 * internally and break under ESM bundling).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
