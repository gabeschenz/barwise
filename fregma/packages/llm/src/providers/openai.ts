/**
 * OpenAI provider for the LlmClient interface.
 *
 * Uses OpenAI's structured output (response_format with json_schema)
 * to get structured JSON output conforming to the extraction response
 * schema.
 */

import OpenAI from "openai";
import type { LlmClient, CompletionRequest, CompletionResponse } from "../LlmClient.js";

export interface OpenAIClientOptions {
  /** OpenAI API key. Falls back to OPENAI_API_KEY env var. */
  readonly apiKey?: string;
  /** Model to use. Defaults to "gpt-4o". */
  readonly model?: string;
  /** Maximum tokens for the response. Defaults to 8192. */
  readonly maxTokens?: number;
}

/**
 * LlmClient implementation using the OpenAI API.
 *
 * When a responseSchema is provided, it uses the structured output
 * response_format to constrain the output to the specified JSON shape.
 */
export class OpenAILlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options?: OpenAIClientOptions) {
    this.client = new OpenAI({ apiKey: options?.apiKey });
    this.model = options?.model ?? "gpt-4o";
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
    const start = Date.now();
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    });
    const latencyMs = Date.now() - start;

    return {
      content: response.choices[0]?.message?.content ?? "",
      modelUsed: this.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
      } : undefined,
      latencyMs,
    };
  }

  private async completeStructured(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const start = Date.now();
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
    const latencyMs = Date.now() - start;

    return {
      content: response.choices[0]?.message?.content ?? "",
      modelUsed: this.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
      } : undefined,
      latencyMs,
    };
  }
}
