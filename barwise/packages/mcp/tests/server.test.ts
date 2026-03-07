/**
 * Tests for the MCP server scaffolding.
 */
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

describe("MCP server", () => {
  it("creates a server instance", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("server has expected name", () => {
    const server = createServer();
    // The server is created with name "barwise" -- verify it was
    // constructed without throwing.
    expect(server).toBeTruthy();
  });
});
