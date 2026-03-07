import * as esbuild from "esbuild";

/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  minify: false,
  external: ["vscode", "web-worker"],
  loader: { ".json": "json" },
  // Suppress import.meta.url warnings -- esbuild bundles the JSON
  // files directly, so the createRequire calls in core are dead code
  // in the bundled output.
  logLevel: "warning",
};

const serverBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/server/OrmLanguageServer.ts"],
  outfile: "dist/server/OrmLanguageServer.js",
});

const clientBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/client/extension.ts"],
  outfile: "dist/client/extension.js",
});

// MCP server -- standalone stdio process spawned by VS Code via
// McpStdioServerDefinition. Also used by external MCP clients that
// discover the server through VS Code. Note: the primary integration
// with Copilot Chat is through vscode.lm.registerTool() (see
// ToolRegistration.ts), which runs in-process. This stdio bundle
// exists for MCP protocol compatibility with external tools.
const mcpBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/mcp/stdio-entry.ts"],
  outfile: "dist/mcp/index.js",
  banner: { js: "#!/usr/bin/env node" },
});

await Promise.all([serverBuild, clientBuild, mcpBuild]);
console.log("Build complete.");
