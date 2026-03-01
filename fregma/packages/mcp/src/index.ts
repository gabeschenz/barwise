#!/usr/bin/env node
/**
 * Entry point for the fregma-mcp binary.
 * Starts the MCP server with stdio transport.
 */

import { createServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
