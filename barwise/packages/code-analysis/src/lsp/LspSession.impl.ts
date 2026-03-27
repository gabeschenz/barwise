/**
 * Concrete LSP session implementation using JSON-RPC over stdio.
 *
 * Wraps the LspJsonRpc transport with type-safe LSP method calls.
 */

import type {
  CallHierarchyItem,
  DocumentSymbol,
  HoverResult,
  Location,
  LspSession,
  SymbolInformation,
} from "../types.js";
import type { LspJsonRpc } from "./LspJsonRpc.js";

/**
 * LSP session backed by a JSON-RPC connection to a language server.
 */
export class LspSessionImpl implements LspSession {
  private readonly rpc: LspJsonRpc;
  private stopped = false;

  constructor(rpc: LspJsonRpc) {
    this.rpc = rpc;
  }

  async documentSymbols(uri: string): Promise<DocumentSymbol[]> {
    this.ensureAlive();
    const result = await this.rpc.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    return (result as DocumentSymbol[] | null) ?? [];
  }

  async typeDefinition(uri: string, line: number, character: number): Promise<Location[]> {
    this.ensureAlive();
    const result = await this.rpc.sendRequest("textDocument/typeDefinition", {
      textDocument: { uri },
      position: { line, character },
    });
    return normalizeLocations(result);
  }

  async references(uri: string, line: number, character: number): Promise<Location[]> {
    this.ensureAlive();
    const result = await this.rpc.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: false },
    });
    return normalizeLocations(result);
  }

  async hover(uri: string, line: number, character: number): Promise<HoverResult | null> {
    this.ensureAlive();
    const result = await this.rpc.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    });
    return (result as HoverResult | null) ?? null;
  }

  async callHierarchy(uri: string, line: number, character: number): Promise<CallHierarchyItem[]> {
    this.ensureAlive();
    try {
      const prepareResult = await this.rpc.sendRequest(
        "textDocument/prepareCallHierarchy",
        {
          textDocument: { uri },
          position: { line, character },
        },
      );

      const items = (prepareResult as CallHierarchyItem[] | null) ?? [];
      if (items.length === 0) return [];

      // Get incoming calls for the first item
      const incomingResult = await this.rpc.sendRequest(
        "callHierarchy/incomingCalls",
        { item: items[0] },
      );

      const incoming = (incomingResult as Array<{ from: CallHierarchyItem; }> | null) ?? [];
      return incoming.map((call) => call.from);
    } catch {
      // Call hierarchy may not be supported by all servers
      return [];
    }
  }

  async workspaceSymbols(query: string): Promise<SymbolInformation[]> {
    this.ensureAlive();
    const result = await this.rpc.sendRequest("workspace/symbol", { query });
    return (result as SymbolInformation[] | null) ?? [];
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;

    try {
      // LSP shutdown handshake
      await this.rpc.sendRequest("shutdown", null);
      this.rpc.sendNotification("exit", null);
    } catch {
      // Server may already be gone
    }

    // Allow a moment for clean exit, then force close
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.rpc.close();
        resolve();
      }, 500);
    });
  }

  private ensureAlive(): void {
    if (this.stopped) {
      throw new Error("LSP session has been stopped");
    }
  }
}

/**
 * Normalize LSP location responses (can be Location | Location[] | null).
 */
function normalizeLocations(result: unknown): Location[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as Location[];
  return [result as Location];
}
