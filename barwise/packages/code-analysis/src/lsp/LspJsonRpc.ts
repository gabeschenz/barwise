/**
 * JSON-RPC transport layer for LSP communication over stdio.
 *
 * Implements the LSP base protocol: Content-Length header framing over
 * stdin/stdout with JSON-RPC 2.0 message format.
 */

import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

/**
 * A pending JSON-RPC request waiting for a response.
 */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * JSON-RPC 2.0 transport over stdio for LSP communication.
 *
 * Handles message framing (Content-Length headers), request/response
 * correlation, and notification dispatch.
 */
export class LspJsonRpc extends EventEmitter {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private buffer = "";
  private contentLength = -1;
  private readonly process: ChildProcess;

  constructor(process: ChildProcess) {
    super();
    this.process = process;

    if (!process.stdout || !process.stdin) {
      throw new Error("Child process must have stdio pipes");
    }

    process.stdout.setEncoding("utf8");
    process.stdout.on("data", (data: string) => this.onData(data));
    process.stderr?.on("data", (data: string) => {
      this.emit("error", new Error(`LSP stderr: ${data}`));
    });
    process.on("exit", (code) => {
      this.rejectAll(new Error(`LSP server exited with code ${code}`));
      this.emit("exit", code);
    });
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.sendMessage(message);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  sendNotification(method: string, params?: unknown): void {
    const message = { jsonrpc: "2.0", method, params };
    this.sendMessage(message);
  }

  /**
   * Close the connection and reject all pending requests.
   */
  close(): void {
    this.rejectAll(new Error("Connection closed"));
    this.process.stdin?.end();
    this.process.kill();
  }

  private sendMessage(message: Record<string, unknown>): void {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n`;
    this.process.stdin?.write(header + json);
  }

  /**
   * Parse incoming data using the LSP base protocol framing.
   */
  private onData(data: string): void {
    this.buffer += data;

    while (true) {
      if (this.contentLength === -1) {
        // Look for Content-Length header
        const headerEnd = this.buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) break;

        const header = this.buffer.substring(0, headerEnd);
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) {
          // Skip malformed header
          this.buffer = this.buffer.substring(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1]!, 10);
        this.buffer = this.buffer.substring(headerEnd + 4);
      }

      // Check if we have enough data for the body
      const bodyBytes = Buffer.byteLength(this.buffer.substring(0, this.contentLength), "utf8");
      if (bodyBytes < this.contentLength) break;

      // Extract the body based on content length
      // Note: contentLength is in bytes, but we need to handle the string correctly
      const body = this.extractBody(this.contentLength);
      this.contentLength = -1;

      try {
        const message = JSON.parse(body) as Record<string, unknown>;
        this.handleMessage(message);
      } catch {
        this.emit(
          "error",
          new Error(`Failed to parse JSON-RPC message: ${body.substring(0, 200)}`),
        );
      }
    }
  }

  /**
   * Extract exactly `byteLength` bytes from the buffer as a string.
   */
  private extractBody(byteLength: number): string {
    // Convert buffer to a Buffer to handle byte-level extraction
    const buf = Buffer.from(this.buffer, "utf8");
    const bodyBuf = buf.subarray(0, byteLength);
    const body = bodyBuf.toString("utf8");
    this.buffer = buf.subarray(byteLength).toString("utf8");
    return body;
  }

  private handleMessage(message: Record<string, unknown>): void {
    if ("id" in message && "result" in message) {
      // Response to a request
      const id = message["id"] as number;
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        pending.resolve(message["result"]);
      }
    } else if ("id" in message && "error" in message) {
      // Error response
      const id = message["id"] as number;
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        const err = message["error"] as { message?: string; code?: number; };
        pending.reject(new Error(`LSP error ${err.code}: ${err.message}`));
      }
    } else if ("method" in message && !("id" in message)) {
      // Notification from server (no id = notification)
      this.emit("notification", {
        method: message["method"],
        params: message["params"],
      });
    } else if ("method" in message && "id" in message) {
      // Server-initiated request (e.g., window/showMessage)
      // Respond with null result
      this.sendMessage({
        jsonrpc: "2.0",
        id: message["id"],
        result: null,
      });
    }
  }

  private rejectAll(error: Error): void {
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
