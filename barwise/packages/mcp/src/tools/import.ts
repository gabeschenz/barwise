/**
 * import_transcript tool: processes a transcript through LLM extraction.
 */

import { annotateOrmYaml, OrmYamlSerializer } from "@barwise/core";
import { buildExistingModelContext, createLlmClient, processTranscript } from "@barwise/llm";
import type { ProviderName } from "@barwise/llm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readSource, resolveSource } from "../helpers/resolve.js";

const serializer = new OrmYamlSerializer();

export function registerImportTool(server: McpServer): void {
  server.registerTool(
    "import_transcript",
    {
      title: "Import Transcript",
      description: "Process a business domain transcript through LLM extraction "
        + "to produce a formal ORM 2 model. Requires an LLM provider "
        + "configured via environment variables or explicit options.",
      inputSchema: {
        transcript: z
          .string()
          .describe("Transcript text or file path to a text file"),
        modelName: z
          .string()
          .default("Extracted Model")
          .describe("Name for the resulting ORM model"),
        base: z
          .string()
          .optional()
          .describe(
            "File path or inline YAML of an existing base model. "
            + "When provided, the LLM is told which types already exist "
            + "so it can reference them instead of redefining them.",
          ),
        provider: z
          .enum(["anthropic", "openai", "ollama"])
          .optional()
          .describe(
            "LLM provider. Auto-detects from env vars if omitted.",
          ),
        model: z
          .string()
          .optional()
          .describe("LLM model override (e.g. 'gpt-4o', 'claude-sonnet-4-5-20250929')"),
      },
    },
    async ({ transcript, modelName, base, provider, model }) => {
      return executeImport(
        transcript,
        modelName,
        provider as ProviderName | undefined,
        model,
        base,
      );
    },
  );
}

export async function executeImport(
  transcript: string,
  modelName: string = "Extracted Model",
  provider?: ProviderName,
  model?: string,
  base?: string,
): Promise<{ content: Array<{ type: "text"; text: string; }>; }> {
  const text = readSource(transcript);

  const client = createLlmClient({
    provider,
    model,
  });

  // Build context from the base model so the LLM knows which types
  // already exist and can reference them by name.
  let existingModelContext: string | undefined;
  if (base) {
    try {
      const baseModel = resolveSource(base);
      existingModelContext = buildExistingModelContext(baseModel);
    } catch {
      // Non-critical: proceed without context.
    }
  }

  const result = await processTranscript(text, client, {
    modelName,
    existingModelContext,
  });

  const yaml = serializer.serialize(result.model);
  const annotated = annotateOrmYaml(yaml, result);

  return {
    content: [{ type: "text" as const, text: annotated.yaml }],
  };
}
