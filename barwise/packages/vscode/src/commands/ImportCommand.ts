/**
 * ORM: Import... -- quick pick router for import workflows.
 *
 * Presents a picker with import source options:
 *   - From Transcript  (LLM extraction)
 *   - From dbt Project (dbt schema import)
 */
import * as vscode from "vscode";
import { ImportDbtCommand } from "./ImportDbtCommand.js";
import { ImportTranscriptCommand } from "./ImportTranscriptCommand.js";

interface ImportOption extends vscode.QuickPickItem {
  readonly id: "transcript" | "dbt";
}

const IMPORT_OPTIONS: ImportOption[] = [
  {
    id: "transcript",
    label: "From Transcript",
    description: "Extract ORM model from a conversation transcript using an LLM",
  },
  {
    id: "dbt",
    label: "From dbt Project",
    description: "Import entity and fact types from a dbt project's schema YAML",
  },
];

export class ImportCommand {
  async execute(): Promise<void> {
    const picked = await vscode.window.showQuickPick(IMPORT_OPTIONS, {
      title: "Import ORM Model",
      placeHolder: "Choose an import source",
    });

    if (!picked) return;

    switch (picked.id) {
      case "transcript":
        return new ImportTranscriptCommand().execute();
      case "dbt":
        return new ImportDbtCommand().execute();
    }
  }
}
