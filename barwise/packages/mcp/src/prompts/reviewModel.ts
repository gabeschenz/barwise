/**
 * review-model prompt: guides AI through model quality review.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerReviewModelPrompt(server: McpServer): void {
  server.registerPrompt(
    "review-model",
    {
      title: "Review ORM Model",
      description: "Review an existing ORM 2 model for quality, completeness, "
        + "and correctness. Runs validation, verbalization, and schema "
        + "generation to identify issues.",
      argsSchema: {
        filePath: z
          .string()
          .describe("Path to the .orm.yaml file to review"),
      },
    },
    ({ filePath }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review the ORM model at ${filePath} for quality:\n`
              + "1. Run validate_model to check for errors\n"
              + "2. Run verbalize_model to check that readings are natural\n"
              + "3. Run generate_schema to verify the relational mapping\n"
              + "4. Suggest improvements for completeness and clarity",
          },
        },
      ],
    }),
  );
}
