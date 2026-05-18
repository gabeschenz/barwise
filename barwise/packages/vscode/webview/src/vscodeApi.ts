/**
 * Typed bridge to the VS Code webview host.
 *
 * `acquireVsCodeApi` may only be called once per webview, so the handle
 * is captured here at module load and shared. When the bundle is loaded
 * outside VS Code (isolated webview dev) the API is absent and messages
 * are no-ops.
 */
import type { InboundMessage, OutboundMessage } from "../../src/diagram/protocol";

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const api: VsCodeApi | null = typeof acquireVsCodeApi === "function"
  ? acquireVsCodeApi()
  : null;

/** Send a typed message to the extension host. */
export function postMessage(message: OutboundMessage): void {
  api?.postMessage(message);
}

/**
 * Subscribe to typed messages from the extension host. Returns an
 * unsubscribe function.
 */
export function onMessage(handler: (message: InboundMessage) => void): () => void {
  const listener = (event: MessageEvent): void => {
    handler(event.data as InboundMessage);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
