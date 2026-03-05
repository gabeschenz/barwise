# MCP Distribution and Integration Spec

## Problem

The current MCP documentation (`docs/MCP.md`) requires users to clone
the repository and run `npm run build`, then point clients at an
absolute path to `dist/index.js`. This is a developer workflow, not an
end-user workflow. A user who installs the VS Code extension should not
need to clone or build anything.

## Goal

Two distribution modes for the fregma MCP server:

1. **VS Code extension users**: Install the extension, MCP server is
   automatically available. An optional setting controls whether it is
   enabled (default: enabled).

2. **External tool users** (Claude Code, Cursor, Windsurf, Claude
   Desktop, etc.): Run `npx @fregma/mcp` -- no clone, no build.

## Design

### Part A: Bundle MCP Server Into VS Code Extension

VS Code 1.99+ supports extensions contributing MCP servers via the
`contributes.mcpServerDefinitionProviders` package.json contribution
point and the `vscode.lm.registerMcpServerDefinitionProvider()` runtime
API. When a user installs the extension, VS Code discovers the MCP
server automatically and makes it available in Copilot Chat and any
other MCP-aware feature.

#### Changes

1. **esbuild.mjs** -- Add a third entry point that bundles the MCP
   server code (from `@fregma/mcp`) into `dist/mcp/index.js`. This
   bundles core, diagram, llm, MCP SDK, and zod into a single file.

2. **package.json** -- Add:
   - `contributes.mcpServerDefinitionProviders` with id `fregma.mcpServer`
   - `fregma.enableMcpServer` boolean setting (default: `true`)
   - Bump `engines.vscode` to `^1.99.0`
   - Bump `@types/vscode` to `^1.99.0`

3. **src/mcp/McpServerProvider.ts** -- New module that implements
   `McpServerDefinitionProvider`:
   - `provideMcpServerDefinitions()` checks the `fregma.enableMcpServer`
     setting. If enabled, returns an `McpStdioServerDefinition` pointing
     to the bundled `dist/mcp/index.js`. If disabled, returns `[]`.
   - `resolveMcpServerDefinition()` passes through the definition.
   - Fires `onDidChangeMcpServerDefinitions` when the setting changes.

4. **src/client/extension.ts** -- Call
   `registerMcpServerDefinitionProvider()` during activation and push
   the disposable into `context.subscriptions`.

5. **src/mcp/stdio-entry.ts** -- Standalone entry point that imports
   `createServer` from `@fregma/mcp/server` and connects stdio
   transport. This is what esbuild bundles to `dist/mcp/index.js`.

#### User Experience

- Install extension -> MCP tools appear in Copilot Chat automatically.
- To disable: set `fregma.enableMcpServer` to `false`.
- No config files, no build steps, no absolute paths.

### Part B: Standalone npx Binary

For users outside VS Code, `@fregma/mcp` needs to be publishable to
npm as a self-contained binary.

#### Changes

1. **packages/mcp/esbuild.mjs** -- New esbuild config that bundles
   the MCP server and all its dependencies (core, diagram, llm, MCP
   SDK, zod, elkjs, yaml, ajv) into a single `dist/bundle/index.js`.
   This is separate from the `tsc` build used within the monorepo.

2. **packages/mcp/package.json** -- Changes for npm publishing:
   - Remove `"private": true`
   - Update `bin` to point to `./dist/bundle/index.js`
   - Add `files` field to include only the bundle
   - Add `repository`, `keywords`, `license` fields
   - Add `"prepublishOnly": "node esbuild.mjs"` script
   - Move workspace dependencies (`@fregma/core`, `@fregma/diagram`,
     `@fregma/llm`) to devDependencies (they are bundled, not needed
     at install time)
   - Keep `@modelcontextprotocol/sdk` and `zod` as devDependencies
     too (also bundled)

3. **Publishing** -- `npm publish --access public` from
   `packages/mcp/` after running the esbuild bundle.

#### User Experience

```sh
# Any MCP client config:
npx @fregma/mcp
```

No clone, no build, no dependencies to install. The npx command
downloads the package, runs the single bundled entry point, and starts
the stdio MCP server.

### Part C: Documentation Rewrite

Rewrite `docs/MCP.md` with two clear sections:

1. **VS Code users** -- "Install the Fregma ORM Modeler extension.
   The MCP server is enabled by default. You can toggle it via the
   `fregma.enableMcpServer` setting."

2. **Other AI tools** -- Show `npx @fregma/mcp` config for each
   supported client (Claude Code, Claude Desktop, Cursor, Windsurf,
   GitHub Copilot via mcp.json).

3. **Environment variables** -- Same section for LLM provider keys.

4. **Tools / Resources / Prompts** -- Reference section unchanged.

## Implementation Stages

### Stage 1: Bundle MCP into VS Code extension
**Goal**: MCP server works from the extension with zero config.
**Success Criteria**:
- esbuild produces `dist/mcp/index.js` with all dependencies
- Extension activates and registers MCP server definition
- Setting `fregma.enableMcpServer` toggles the server
- `npx tsc --noEmit` passes
- All existing tests still pass
**Status**: Not Started

### Stage 2: Standalone npx bundle for @fregma/mcp
**Goal**: `npx @fregma/mcp` starts the server from a self-contained
bundle.
**Success Criteria**:
- `node esbuild.mjs` in packages/mcp produces a working single-file
  bundle
- `node dist/bundle/index.js` starts the MCP server
- Bundle size is reasonable (< 5 MB)
- Existing vitest tests still pass against the tsc-compiled code
**Status**: Not Started

### Stage 3: Documentation rewrite
**Goal**: Clear, two-audience docs.
**Success Criteria**:
- VS Code section has no mention of cloning or building
- External tools section uses `npx @fregma/mcp`
- All client configs are correct
**Status**: Not Started

## API Compatibility Note

The `vscode.lm.registerMcpServerDefinitionProvider` API was introduced
in VS Code 1.99 (April 2025). This bumps our minimum engine from
`^1.93.0` to `^1.99.0`. Since VS Code auto-updates and 1.99 is nearly
a year old, this should not be a problem for users.

If the API types are not yet in `@types/vscode`, we can declare local
type stubs until they are available.
