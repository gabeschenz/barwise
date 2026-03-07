/**
 * Tests for the orm-schema://json-schema resource.
 */
import { describe, expect, it } from "vitest";
import { createServer } from "../../src/server.js";

describe("orm-schema resource", () => {
  it("server creates without error", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
