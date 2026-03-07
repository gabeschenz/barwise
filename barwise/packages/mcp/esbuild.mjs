/**
 * Standalone bundle builder for @barwise/mcp.
 *
 * Produces a single self-contained file at dist/bundle/index.js that
 * includes all dependencies (@barwise/core, @barwise/diagram, @barwise/llm,
 * MCP SDK, zod, elkjs, yaml, ajv, etc.). This is what gets published
 * to npm so that `npx @barwise/mcp` works without installing anything
 * else.
 */

import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/bundle-entry.ts"],
  outfile: "dist/bundle/index.cjs",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  minify: false,
  banner: { js: "#!/usr/bin/env node" },
  loader: { ".json": "json" },
  // elkjs optionally uses web-worker for browser environments; not
  // needed in Node.js where it falls back to synchronous execution.
  external: ["web-worker"],
  logLevel: "warning",
});

console.log("Bundle complete.");
