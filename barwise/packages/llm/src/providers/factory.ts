/**
 * Provider factory for LlmClient instances.
 *
 * Creates the appropriate LlmClient from a provider name or
 * auto-detects the provider from environment variables.
 */

import type { LlmClient } from "../LlmClient.js";
import { AnthropicLlmClient } from "./anthropic.js";
import { OpenAILlmClient } from "./openai.js";
import { OllamaLlmClient } from "./ollama.js";

export type ProviderName = "anthropic" | "openai" | "ollama";

export interface ProviderOptions {
  /** Explicit provider name. If omitted, auto-detects from env vars. */
  readonly provider?: ProviderName;
  /** API key (for anthropic/openai). Falls back to env vars. */
  readonly apiKey?: string;
  /** Model override. Each provider has its own default. */
  readonly model?: string;
  /** Ollama server URL. Only used when provider is "ollama". */
  readonly baseUrl?: string;
}

/**
 * Create an LlmClient from options. Auto-detects provider from
 * environment variables when no explicit provider is given:
 *
 * - ANTHROPIC_API_KEY set -> anthropic
 * - OPENAI_API_KEY set -> openai
 * - Neither set -> ollama (local, no key required)
 */
export function createLlmClient(options?: ProviderOptions): LlmClient {
  const provider = options?.provider ?? detectProvider();

  switch (provider) {
    case "anthropic":
      return new AnthropicLlmClient({
        apiKey: options?.apiKey,
        model: options?.model,
      });
    case "openai":
      return new OpenAILlmClient({
        apiKey: options?.apiKey,
        model: options?.model,
      });
    case "ollama":
      return new OllamaLlmClient({
        baseUrl: options?.baseUrl,
        model: options?.model,
      });
  }
}

/**
 * Detect the LLM provider from environment variables.
 *
 * Priority: ANTHROPIC_API_KEY > OPENAI_API_KEY > ollama (fallback).
 */
export function detectProvider(): ProviderName {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "ollama";
}
