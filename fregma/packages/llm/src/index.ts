// Extraction types
export type {
  SourceReference,
  ExtractedObjectType,
  ExtractedRole,
  ExtractedFactType,
  ExtractedSubtype,
  InferredConstraintType,
  InferredConstraint,
  Ambiguity,
  ExtractionResponse,
  ElementProvenance,
  ConstraintProvenance,
  SubtypeProvenance,
  DraftModelResult,
} from "./ExtractionTypes.js";

// LLM client interface
export type {
  LlmClient,
  CompletionRequest,
  CompletionResponse,
} from "./LlmClient.js";

// Prompt construction
export {
  buildSystemPrompt,
  buildUserMessage,
  buildResponseSchema,
  parseExtractionResponse,
} from "./ExtractionPrompt.js";

// Model parser
export { parseDraftModel } from "./DraftModelParser.js";

// Pipeline orchestrator
export {
  processTranscript,
  parseExtractionFromJson,
} from "./TranscriptProcessor.js";
export type { ProcessorOptions } from "./TranscriptProcessor.js";

// Providers
export { AnthropicLlmClient } from "./providers/anthropic.js";
export type { AnthropicClientOptions } from "./providers/anthropic.js";
export { OpenAILlmClient } from "./providers/openai.js";
export type { OpenAIClientOptions } from "./providers/openai.js";
export { OllamaLlmClient } from "./providers/ollama.js";
export type { OllamaClientOptions } from "./providers/ollama.js";

// Provider factory
export { createLlmClient, detectProvider } from "./providers/factory.js";
export type { ProviderName, ProviderOptions } from "./providers/factory.js";
