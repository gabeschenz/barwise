/**
 * Orchestrates the full transcript-to-model pipeline.
 *
 * Pipeline:
 *   Raw Transcript -> LLM Extraction -> JSON Parsing -> Conformance Validation -> OrmModel Construction
 *
 * The processor is the main entry point for the LLM package. It coordinates
 * the prompt construction, LLM call, response parsing, and model building.
 */

import { parseDraftModel } from "./DraftModelParser.js";
import { enforceConformance } from "./ExtractionConformance.js";
import {
  buildResponseSchema,
  buildSystemPrompt,
  buildUserMessage,
  parseExtractionResponse,
} from "./ExtractionPrompt.js";
import type { DraftModelResult, ExtractionResponse } from "./ExtractionTypes.js";
import type { LlmClient } from "./LlmClient.js";

export interface ProcessorOptions {
  /** Name for the resulting model. Defaults to "Extracted Model". */
  readonly modelName?: string;
}

/**
 * Process a transcript through the LLM extraction pipeline.
 *
 * @param transcript - The raw transcript text
 * @param client - The LLM client to use for extraction
 * @param options - Optional configuration
 * @returns A draft model with provenance metadata and warnings
 */
export async function processTranscript(
  transcript: string,
  client: LlmClient,
  options?: ProcessorOptions,
): Promise<DraftModelResult> {
  if (!transcript.trim()) {
    throw new Error("Transcript is empty.");
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(transcript);
  const responseSchema = buildResponseSchema();

  const response = await client.complete({
    systemPrompt,
    userMessage,
    responseSchema,
  });

  let extraction: ExtractionResponse;
  try {
    const parsed = JSON.parse(response.content);
    extraction = parseExtractionResponse(parsed);
  } catch (err) {
    throw new Error(
      `Failed to parse LLM extraction response: ${(err as Error).message}`,
      { cause: err },
    );
  }

  // Apply deterministic conformance checks before model construction.
  const { response: cleaned, corrections } = enforceConformance(extraction);

  const modelName = options?.modelName ?? "Extracted Model";
  const result = parseDraftModel(cleaned, modelName);
  const conformanceWarnings = corrections.map((c) => c.description);
  return {
    ...result,
    warnings: [...conformanceWarnings, ...result.warnings],
    modelUsed: response.modelUsed,
    usage: response.usage,
    latencyMs: response.latencyMs,
    rawResponse: response.content,
  };
}

/**
 * Parse a pre-existing extraction response JSON string into a model.
 * Useful for re-processing saved LLM responses without making a new API call.
 */
export function parseExtractionFromJson(
  json: string,
  modelName: string,
): DraftModelResult {
  const parsed = JSON.parse(json);
  const extraction = parseExtractionResponse(parsed);
  const { response: cleaned, corrections } = enforceConformance(extraction);
  const result = parseDraftModel(cleaned, modelName);
  const conformanceWarnings = corrections.map((c) => c.description);
  return {
    ...result,
    warnings: [...conformanceWarnings, ...result.warnings],
  };
}
