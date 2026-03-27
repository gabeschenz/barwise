/**
 * TypeScript language server defaults and configuration.
 */

import type { LspConfig } from "../../types.js";

/**
 * Default LspConfig for a TypeScript project.
 *
 * Uses `typescript-language-server` with stdio transport. This is the
 * standard TypeScript LSP implementation used by most editors. It wraps
 * `tsserver` and provides a full LSP interface.
 *
 * Install: `npm install -g typescript-language-server typescript`
 */
export function defaultTypeScriptConfig(workspaceRoot: string): LspConfig {
  return {
    language: "typescript",
    workspaceRoot,
    command: "typescript-language-server",
    args: ["--stdio"],
    initOptions: {
      tsserver: {
        logVerbosity: "off",
      },
      preferences: {
        includeInlayParameterNameHints: "none",
        includeInlayVariableTypeHints: false,
      },
    },
  };
}
