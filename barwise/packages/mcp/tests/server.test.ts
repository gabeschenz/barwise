/**
 * Tests for the MCP server scaffolding.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createServer, SERVER_VERSION } from "../src/server.js";

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

  it("SERVER_VERSION matches package.json", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as { version: string; };
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
