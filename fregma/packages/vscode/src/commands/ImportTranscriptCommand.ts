import * as vscode from "vscode";
import * as path from "node:path";
import { OrmYamlSerializer } from "@fregma/core";
import { processTranscript, AnthropicLlmClient } from "@fregma/llm";
import type { LlmClient, DraftModelResult } from "@fregma/llm";
import { CopilotLlmClient } from "../llm/CopilotLlmClient.js";

const serializer = new OrmYamlSerializer();

export class ImportTranscriptCommand {
  async execute(): Promise<void> {
    // Step 1: Pick the transcript file.
    const files = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        "Transcripts": ["md", "txt"],
        "All Files": ["*"],
      },
      title: "Select a transcript file",
    });

    if (!files || files.length === 0) return;

    const transcriptUri = files[0]!;
    const transcriptBytes = await vscode.workspace.fs.readFile(transcriptUri);
    const transcript = Buffer.from(transcriptBytes).toString("utf-8");

    if (!transcript.trim()) {
      vscode.window.showWarningMessage("The selected transcript file is empty.");
      return;
    }

    // Step 2: Build the LLM client from settings.
    const config = vscode.workspace.getConfiguration("fregma");
    const provider = config.get<string>("llmProvider") ?? "copilot";
    const client = buildLlmClient(provider, config);

    // Step 3: Ask for a model name.
    const baseName = path.basename(
      transcriptUri.fsPath,
      path.extname(transcriptUri.fsPath),
    );
    const modelName = await vscode.window.showInputBox({
      prompt: "Name for the extracted model",
      value: baseName,
      validateInput: (v) =>
        v.trim().length === 0 ? "Model name is required" : null,
    });

    if (!modelName) return;

    // Step 4: Run the extraction with progress.
    let result: DraftModelResult;
    try {
      result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Extracting ORM model from transcript...",
          cancellable: false,
        },
        async () => {
          return processTranscript(transcript, client, { modelName });
        },
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Transcript extraction failed: ${(err as Error).message}`,
      );
      return;
    }

    // Step 5: Serialize the draft model to YAML.
    const yaml = serializer.serialize(result.model);

    // Step 6: Write the .orm.yaml file next to the transcript.
    const outputDir = path.dirname(transcriptUri.fsPath);
    const outputName = `${baseName}.orm.yaml`;
    const outputUri = vscode.Uri.file(path.join(outputDir, outputName));
    await vscode.workspace.fs.writeFile(
      outputUri,
      Buffer.from(yaml, "utf-8"),
    );

    // Step 7: Open the generated file.
    const doc = await vscode.workspace.openTextDocument(outputUri);
    await vscode.window.showTextDocument(doc);

    // Step 8: Report results.
    const summary = buildSummary(result);
    vscode.window.showInformationMessage(summary);

    // Show warnings in output channel if any.
    if (result.warnings.length > 0 || result.ambiguities.length > 0) {
      const channel = vscode.window.createOutputChannel("ORM Transcript Import");
      channel.appendLine(`=== Import: ${modelName} ===`);
      channel.appendLine("");

      if (result.ambiguities.length > 0) {
        channel.appendLine("AMBIGUITIES:");
        for (const a of result.ambiguities) {
          channel.appendLine(`  - ${a.description}`);
          for (const ref of a.source_references) {
            channel.appendLine(`    [lines ${ref.lines[0]}-${ref.lines[1]}] "${ref.excerpt}"`);
          }
        }
        channel.appendLine("");
      }

      if (result.warnings.length > 0) {
        channel.appendLine("WARNINGS:");
        for (const w of result.warnings) {
          channel.appendLine(`  - ${w}`);
        }
        channel.appendLine("");
      }

      const skipped = result.constraintProvenance.filter((c) => !c.applied);
      if (skipped.length > 0) {
        channel.appendLine("SKIPPED CONSTRAINTS:");
        for (const c of skipped) {
          channel.appendLine(`  - ${c.description}`);
          channel.appendLine(`    Reason: ${c.skipReason}`);
        }
      }

      channel.show(true);
    }
  }
}

function buildLlmClient(
  provider: string,
  config: vscode.WorkspaceConfiguration,
): LlmClient {
  if (provider === "anthropic") {
    const apiKey = config.get<string>("anthropicApiKey") || undefined;
    const model = config.get<string>("anthropicModel") || undefined;
    return new AnthropicLlmClient({ apiKey, model });
  }

  // Default: copilot
  const family = config.get<string>("copilotModelFamily") || undefined;
  return new CopilotLlmClient({ family });
}

function buildSummary(result: DraftModelResult): string {
  const ots = result.model.objectTypes.length;
  const fts = result.model.factTypes.length;
  const applied = result.constraintProvenance.filter((c) => c.applied).length;
  const ambiguities = result.ambiguities.length;
  const warnings = result.warnings.length;

  let msg = `Extracted ${ots} object types, ${fts} fact types, ${applied} constraints.`;
  if (ambiguities > 0) msg += ` ${ambiguities} ambiguity(ies) flagged.`;
  if (warnings > 0) msg += ` ${warnings} warning(s).`;
  return msg;
}
