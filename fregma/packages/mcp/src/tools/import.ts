/**
 * import_transcript tool: processes a transcript through LLM extraction.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { processTranscript, createLlmClient } from "@fregma/llm";
import type { ProviderName } from "@fregma/llm";
import { OrmYamlSerializer, annotateOrmYaml } from "@fregma/core";
import { readSource } from "../helpers/resolve.js";

const serializer = new OrmYamlSerializer();

export function registerImportTool(server: McpServer): void {
  server.registerTool(
    "import_transcript",
    {
      title: "Import Transcript",
      description:
        "Process a business domain transcript through LLM extraction " +
        "to produce a formal ORM 2 model. Requires an LLM provider " +
        "configured via environment variables or explicit options.",
      inputSchema: {
        transcript: z
          .string()
          .describe("Transcript text or file path to a text file"),
        modelName: z
          .string()
          .default("Extracted Model")
          .describe("Name for the resulting ORM model"),
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
    async ({ transcript, modelName, provider, model }) => {
      return executeImport(
        transcript,
        modelName,
        provider as ProviderName | undefined,
        model,
      );
    },
  );
}

export async function executeImport(
  transcript: string,
  modelName: string = "Extracted Model",
  provider?: ProviderName,
  model?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const text = readSource(transcript);

  const client = createLlmClient({
    provider,
    model,
  });

  const result = await processTranscript(text, client, {
    modelName,
  });

  const yaml = serializer.serialize(result.model);
  const annotated = annotateOrmYaml(yaml, result);

  return {
    content: [{ type: "text" as const, text: annotated.yaml }],
  };
}
