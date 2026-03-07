/**
 * analyze-domain prompt: guides AI through domain analysis and model extraction.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAnalyzeDomainPrompt(server: McpServer): void {
  server.registerPrompt(
    "analyze-domain",
    {
      title: "Analyze Business Domain",
      description:
        "Analyze a business domain transcript and extract a formal ORM 2 model. " +
        "Guides the AI through entity identification, fact type discovery, and " +
        "constraint analysis.",
      argsSchema: {
        transcript: z
          .string()
          .describe("The business domain transcript to analyze"),
      },
    },
    ({ transcript }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Analyze the following business domain transcript and identify:\n" +
              "1. Entity types (things with identity)\n" +
              "2. Value types (attributes)\n" +
              "3. Fact types (relationships between entities/values)\n" +
              "4. Constraints (uniqueness, mandatory, etc.)\n\n" +
              "Then use the import_transcript tool to extract a formal ORM model.\n\n" +
              `Transcript:\n${transcript}`,
          },
        },
      ],
    }),
  );
}
