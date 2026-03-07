/**
 * Registers barwise ORM tools with VS Code's Language Model Tool API
 * (vscode.lm.registerTool). These tools run in the extension host
 * process and have full access to the VS Code API, including Copilot
 * language models -- unlike the MCP stdio server which runs as a
 * separate child process.
 *
 * Each tool wraps the corresponding execute function from @barwise/mcp,
 * except import_transcript which uses CopilotLlmClient directly.
 */

import { annotateOrmYaml, OrmYamlSerializer } from "@barwise/core";
import { AnthropicLlmClient, processTranscript } from "@barwise/llm";
import type { LlmClient } from "@barwise/llm";
import {
  executeDiagram,
  executeDiff,
  executeMerge,
  executeSchema,
  executeValidate,
  executeVerbalize,
} from "@barwise/mcp";
import * as vscode from "vscode";
import { CopilotLlmClient } from "../llm/CopilotLlmClient.js";

const serializer = new OrmYamlSerializer();

// ---------------------------------------------------------------------------
// Tool input interfaces
// ---------------------------------------------------------------------------

interface ValidateInput {
  source: string;
}

interface VerbalizeInput {
  source: string;
  factType?: string;
}

interface SchemaInput {
  source: string;
  format?: "ddl" | "json";
}

interface DiffInput {
  base: string;
  incoming: string;
}

interface DiagramInput {
  source: string;
}

interface ImportTranscriptInput {
  transcript: string;
  modelName?: string;
}

interface MergeInput {
  base: string;
  incoming: string;
}

// ---------------------------------------------------------------------------
// Helper: extract text from MCP-style result
// ---------------------------------------------------------------------------

function toToolResult(
  mcpResult: { content: Array<{ type: "text"; text: string; }>; },
): vscode.LanguageModelToolResult {
  const text = mcpResult.content.map((c) => c.text).join("\n");
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(text),
  ]);
}

// ---------------------------------------------------------------------------
// validate_model
// ---------------------------------------------------------------------------

class ValidateModelTool implements vscode.LanguageModelTool<ValidateInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ValidateInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = executeValidate(options.input.source);
    return toToolResult(result);
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<ValidateInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Validating ORM model...",
    };
  }
}

// ---------------------------------------------------------------------------
// verbalize_model
// ---------------------------------------------------------------------------

class VerbalizeModelTool implements vscode.LanguageModelTool<VerbalizeInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<VerbalizeInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = executeVerbalize(
      options.input.source,
      options.input.factType,
    );
    return toToolResult(result);
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<VerbalizeInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Verbalizing ORM model...",
    };
  }
}

// ---------------------------------------------------------------------------
// generate_schema
// ---------------------------------------------------------------------------

class GenerateSchemaTool implements vscode.LanguageModelTool<SchemaInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SchemaInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = executeSchema(
      options.input.source,
      options.input.format ?? "ddl",
    );
    return toToolResult(result);
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SchemaInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    const fmt = options.input.format ?? "ddl";
    return {
      invocationMessage: `Generating ${fmt.toUpperCase()} schema...`,
    };
  }
}

// ---------------------------------------------------------------------------
// diff_models
// ---------------------------------------------------------------------------

class DiffModelsTool implements vscode.LanguageModelTool<DiffInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DiffInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = executeDiff(options.input.base, options.input.incoming);
    return toToolResult(result);
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<DiffInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Comparing ORM models...",
    };
  }
}

// ---------------------------------------------------------------------------
// generate_diagram
// ---------------------------------------------------------------------------

class GenerateDiagramTool implements vscode.LanguageModelTool<DiagramInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DiagramInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = await executeDiagram(options.input.source);
    return toToolResult(result);
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<DiagramInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Generating ORM diagram...",
    };
  }
}

// ---------------------------------------------------------------------------
// import_transcript
//
// This tool is special: instead of delegating to the @barwise/mcp
// executeImport (which requires an external LLM provider), it uses
// CopilotLlmClient so the user's Copilot subscription handles the
// LLM call without any API key.
// ---------------------------------------------------------------------------

class ImportTranscriptTool implements vscode.LanguageModelTool<ImportTranscriptInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ImportTranscriptInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { transcript, modelName = "Extracted Model" } = options.input;

    // Resolve the LLM client: prefer Copilot, fall back to Anthropic
    // if the user has configured it.
    const client = await this.resolveClient();

    const result = await processTranscript(transcript, client, { modelName });

    const yaml = serializer.serialize(result.model);
    const annotated = annotateOrmYaml(yaml, result);

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(annotated.yaml),
    ]);
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<ImportTranscriptInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Extracting ORM model from transcript...",
    };
  }

  private async resolveClient(): Promise<LlmClient> {
    const config = vscode.workspace.getConfiguration("barwise");
    const provider = config.get<string>("llmProvider") ?? "copilot";

    if (provider === "anthropic") {
      const apiKey = config.get<string>("anthropicApiKey") || undefined;
      const model = config.get<string>("anthropicModel") || undefined;
      return new AnthropicLlmClient({ apiKey, model });
    }

    // Default: use Copilot (no API key needed).
    const family = config.get<string>("copilotModelFamily") || undefined;
    return new CopilotLlmClient({ family });
  }
}

// ---------------------------------------------------------------------------
// merge_models
// ---------------------------------------------------------------------------

class MergeModelsTool implements vscode.LanguageModelTool<MergeInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<MergeInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const result = executeMerge(options.input.base, options.input.incoming);
    return toToolResult(result);
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<MergeInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Merging ORM models...",
    };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register all barwise ORM tools with vscode.lm.registerTool().
 *
 * The tool names must match the `name` field in the
 * `contributes.languageModelTools` declarations in package.json.
 */
export function registerLanguageModelTools(
  context: vscode.ExtensionContext,
): void {
  const config = vscode.workspace.getConfiguration("barwise");
  const enabled = config.get<boolean>("enableMcpServer", true);

  if (!enabled) return;

  context.subscriptions.push(
    vscode.lm.registerTool("barwise_validate_model", new ValidateModelTool()),
    vscode.lm.registerTool(
      "barwise_verbalize_model",
      new VerbalizeModelTool(),
    ),
    vscode.lm.registerTool(
      "barwise_generate_schema",
      new GenerateSchemaTool(),
    ),
    vscode.lm.registerTool("barwise_diff_models", new DiffModelsTool()),
    vscode.lm.registerTool(
      "barwise_generate_diagram",
      new GenerateDiagramTool(),
    ),
    vscode.lm.registerTool(
      "barwise_import_transcript",
      new ImportTranscriptTool(),
    ),
    vscode.lm.registerTool("barwise_merge_models", new MergeModelsTool()),
  );
}
