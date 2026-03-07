/**
 * Abstract interface for LLM API calls.
 *
 * The LLM provider can be swapped without affecting the core extraction
 * logic. Each provider (Anthropic, OpenAI, etc.) implements this interface.
 */

export interface CompletionRequest {
  readonly systemPrompt: string;
  readonly userMessage: string;
  /** JSON Schema for structured output. The provider maps this to its
   *  native structured output mechanism (tool use, response format, etc.). */
  readonly responseSchema?: Record<string, unknown>;
}

export interface CompletionResponse {
  readonly content: string;
  /** The model identifier that handled this completion. */
  readonly modelUsed?: string;
  /** Token usage reported by the provider, if available. */
  readonly usage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
  };
  /** Wall-clock time of the LLM call in milliseconds, if measured. */
  readonly latencyMs?: number;
}

export interface LlmClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
