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
}

export interface LlmClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
