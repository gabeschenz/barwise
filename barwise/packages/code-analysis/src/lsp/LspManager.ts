/**
 * LSP server lifecycle manager.
 *
 * Starts language servers as child processes, initializes them using the
 * LSP protocol, and returns LspSession instances for querying.
 */

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { LspConfig, LspSession, LspSessionProvider } from "../types.js";
import { LspJsonRpc } from "./LspJsonRpc.js";
import { LspSessionImpl } from "./LspSession.impl.js";

/**
 * Manages the lifecycle of language server processes.
 *
 * Starts servers as child processes, runs the LSP initialization handshake,
 * and provides LspSession instances for querying. Optionally delegates to
 * an LspSessionProvider (e.g. VS Code) for session reuse.
 */
export class LspManager {
  private readonly sessions: LspSessionImpl[] = [];
  private readonly provider?: LspSessionProvider;

  constructor(provider?: LspSessionProvider) {
    this.provider = provider;
  }

  /**
   * Start a language server session for the given configuration.
   *
   * If an LspSessionProvider is available and returns an existing session,
   * that session is used instead of spawning a new process.
   */
  async start(config: LspConfig): Promise<LspSession> {
    // Check provider first (VS Code reuse)
    if (this.provider) {
      const existing = this.provider.getSession(config);
      if (existing) return existing;
    }

    // Spawn the language server process
    const child = spawn(config.command, [...config.args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: config.workspaceRoot,
    });

    // Wait for the process to be alive (catches ENOENT from missing binary)
    await new Promise<void>((resolve, reject) => {
      child.once("error", (err) => reject(err));
      // If the process starts successfully, its stdio will be available
      child.once("spawn", () => resolve());
    });

    const rpc = new LspJsonRpc(child);

    // Run LSP initialization handshake
    const initResult = await rpc.sendRequest("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(config.workspaceRoot).href,
      capabilities: {
        textDocument: {
          documentSymbol: {
            hierarchicalDocumentSymbolSupport: true,
          },
          hover: {
            contentFormat: ["plaintext", "markdown"],
          },
          references: {},
          typeDefinition: {},
          callHierarchy: {},
        },
        workspace: {
          symbol: {
            symbolKind: {
              valueSet: Array.from({ length: 26 }, (_, i) => i + 1),
            },
          },
        },
      },
      initializationOptions: config.initOptions ?? {},
    }) as { capabilities: Record<string, unknown>; };

    // Notify initialized
    rpc.sendNotification("initialized", {});

    // Verify server capabilities (for diagnostic purposes only)
    if (initResult?.capabilities) {
      // Server is ready
    }

    const session = new LspSessionImpl(rpc);
    this.sessions.push(session);
    return session;
  }

  /**
   * Stop all managed sessions.
   */
  async stopAll(): Promise<void> {
    const stops = this.sessions.map((s) => s.stop().catch(() => {/* ignore */}));
    await Promise.all(stops);
    this.sessions.length = 0;
  }
}
