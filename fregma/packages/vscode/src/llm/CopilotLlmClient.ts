/**
 * VS Code Copilot provider for the LlmClient interface.
 *
 * Uses the vscode.lm API to access language models available through
 * GitHub Copilot. This lets users leverage their existing Copilot
 * subscription without needing a separate API key.
 *
 * When a responseSchema is provided, uses the vscode.lm tool_use
 * capability (LanguageModelChatTool + Required tool mode) to get
 * structured JSON output.
 */

import * as vscode from "vscode";
import type {
  LlmClient,
  CompletionRequest,
  CompletionResponse,
} from "@fregma/llm";

export interface CopilotClientOptions {
  /**
   * Model family to select (e.g. "gpt-4o", "claude-sonnet").
   * If omitted, uses whatever Copilot model is available.
   */
  readonly family?: string;
}

export class CopilotLlmClient implements LlmClient {
  private readonly family: string | undefined;

  constructor(options?: CopilotClientOptions) {
    this.family = options?.family;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = await this.selectModel();

    if (request.responseSchema) {
      return this.completeWithTool(model, request);
    }
    return this.completeText(model, request);
  }

  private async selectModel(): Promise<vscode.LanguageModelChat> {
    const selector: vscode.LanguageModelChatSelector = {};
    if (this.family) {
      selector.family = this.family;
    }

    const models = await vscode.lm.selectChatModels(selector);
    if (models.length === 0) {
      throw new Error(
        this.family
          ? `No Copilot language model found for family "${this.family}". ` +
            "Ensure GitHub Copilot is installed and signed in."
          : "No Copilot language model available. " +
            "Ensure GitHub Copilot is installed and signed in.",
      );
    }
    return models[0]!;
  }

  private async completeText(
    model: vscode.LanguageModelChat,
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const messages = [
      vscode.LanguageModelChatMessage.User(
        request.systemPrompt + "\n\n" + request.userMessage,
      ),
    ];

    const response = await model.sendRequest(messages, {
      justification:
        "Fregma needs language model access to extract ORM models from transcripts.",
    });

    let text = "";
    for await (const part of response.text) {
      text += part;
    }
    return { content: text };
  }

  private async completeWithTool(
    model: vscode.LanguageModelChat,
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const toolName = "extract_orm_model";

    const messages = [
      vscode.LanguageModelChatMessage.User(
        request.systemPrompt + "\n\n" + request.userMessage,
      ),
    ];

    const response = await model.sendRequest(messages, {
      justification:
        "Fregma needs language model access to extract ORM models from transcripts.",
      tools: [
        {
          name: toolName,
          description:
            "Extract a structured ORM model from the transcript analysis.",
          inputSchema: request.responseSchema,
        },
      ],
      toolMode: vscode.LanguageModelChatToolMode.Required,
    });

    // Collect tool call parts from the stream.
    let toolInput: object | undefined;
    let textFallback = "";

    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelToolCallPart) {
        toolInput = part.input;
      } else if (part instanceof vscode.LanguageModelTextPart) {
        textFallback += part.value;
      }
    }

    if (toolInput) {
      return { content: JSON.stringify(toolInput) };
    }

    // Fallback: if the model didn't use tool_use, try to extract JSON
    // from the text response.
    if (textFallback) {
      const json = extractJson(textFallback);
      if (json) {
        return { content: json };
      }
    }

    throw new Error(
      "Copilot did not return a tool_use response or parseable JSON.",
    );
  }
}

/**
 * Attempt to extract a JSON object from a text response that may
 * contain markdown fences or surrounding prose.
 */
function extractJson(text: string): string | null {
  // Try fenced code block first.
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) {
    try {
      JSON.parse(fenced[1]!);
      return fenced[1]!;
    } catch {
      // Not valid JSON, fall through.
    }
  }

  // Try bare JSON object.
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = text.slice(braceStart, braceEnd + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Not valid JSON.
    }
  }

  return null;
}
