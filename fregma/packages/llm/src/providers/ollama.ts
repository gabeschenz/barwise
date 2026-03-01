/**
 * Ollama provider for the LlmClient interface.
 *
 * Uses Ollama's OpenAI-compatible REST API via the openai package
 * with a custom baseURL. This avoids adding a separate dependency.
 *
 * Ollama runs models locally with no API key required, making it
 * the default fallback when no cloud provider keys are configured.
 */

import OpenAI from "openai";
import type { LlmClient, CompletionRequest, CompletionResponse } from "../LlmClient.js";

export interface OllamaClientOptions {
  /** Ollama server URL. Defaults to "http://localhost:11434". */
  readonly baseUrl?: string;
  /** Model to use. Defaults to "llama3.1". */
  readonly model?: string;
  /** Maximum tokens for the response. Defaults to 8192. */
  readonly maxTokens?: number;
}

/**
 * LlmClient implementation using a local Ollama server.
 *
 * Ollama exposes an OpenAI-compatible API at /v1, so we reuse the
 * openai package with a custom baseURL. Structured output uses the
 * same response_format mechanism.
 */
export class OllamaLlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options?: OllamaClientOptions) {
    const baseURL = (options?.baseUrl ?? "http://localhost:11434") + "/v1";
    this.client = new OpenAI({ baseURL, apiKey: "ollama" });
    this.model = options?.model ?? "llama3.1";
    this.maxTokens = options?.maxTokens ?? 8192;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (request.responseSchema) {
      return this.completeStructured(request);
    }
    return this.completeText(request);
  }

  private async completeText(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    });

    return { content: response.choices[0]?.message?.content ?? "" };
  }

  private async completeStructured(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "extract_orm_model",
          schema: request.responseSchema as Record<string, unknown>,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message?.content ?? "";

    // Ollama may wrap structured output in markdown code fences.
    // Strip them if present.
    return { content: extractJson(content) };
  }
}

/**
 * Extract JSON from a response that may be wrapped in markdown
 * code fences (```json ... ```). Returns the input unchanged if
 * no fences are found.
 */
export function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return fenceMatch ? fenceMatch[1]!.trim() : text;
}
