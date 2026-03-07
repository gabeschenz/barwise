/**
 * Provides the bundled MCP server definition to VS Code.
 *
 * When `barwise.enableMcpServer` is true, returns an McpStdioServerDefinition
 * that points to the bundled MCP server at `dist/mcp/index.js`. VS Code
 * spawns it as a child process and routes MCP tool calls through stdio.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as vscode from "vscode";

/**
 * Register the MCP server definition provider.
 *
 * The provider watches the `barwise.enableMcpServer` setting and fires
 * `onDidChangeMcpServerDefinitions` when it changes, so VS Code picks
 * up the addition or removal of the server without a reload.
 */
export function registerMcpServerProvider(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  const onDidChange = new vscode.EventEmitter<void>();

  const provider = vscode.lm.registerMcpServerDefinitionProvider(
    "barwise.mcpServer",
    {
      onDidChangeMcpServerDefinitions: onDidChange.event,

      provideMcpServerDefinitions(
        _token: vscode.CancellationToken,
      ): vscode.McpServerDefinition[] {
        const config = vscode.workspace.getConfiguration("barwise");
        const enabled = config.get<boolean>("enableMcpServer", true);

        if (!enabled) {
          return [];
        }

        const mcpModule = context.asAbsolutePath(
          path.join("dist", "mcp", "index.js"),
        );

        if (!fs.existsSync(mcpModule)) {
          void vscode.window.showErrorMessage(
            "Barwise: bundled MCP server not found at " +
              mcpModule +
              ". Try rebuilding the extension (node esbuild.mjs).",
          );
          return [];
        }

        return [
          new vscode.McpStdioServerDefinition(
            "Barwise ORM",
            process.execPath,
            [mcpModule],
            {},
            context.extension.packageJSON.version,
          ),
        ];
      },

      resolveMcpServerDefinition(
        server: vscode.McpServerDefinition,
        _token: vscode.CancellationToken,
      ): vscode.McpServerDefinition {
        return server;
      },
    },
  );

  // Re-publish definitions when the setting changes.
  const settingWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("barwise.enableMcpServer")) {
      onDidChange.fire();
    }
  });

  return vscode.Disposable.from(provider, settingWatcher, onDidChange);
}
