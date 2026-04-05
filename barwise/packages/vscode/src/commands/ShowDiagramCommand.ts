import { OrmYamlSerializer } from "@barwise/core";
import { generateDiagram } from "@barwise/diagram";
import * as vscode from "vscode";
import { DiagramPanel } from "../diagram/DiagramPanel.js";

const serializer = new OrmYamlSerializer();

export class ShowDiagramCommand {
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith(".orm.yaml")) {
      vscode.window.showWarningMessage(
        "Open an .orm.yaml file to show its diagram.",
      );
      return;
    }

    const text = editor.document.getText();
    try {
      const model = serializer.deserialize(text);
      const result = await generateDiagram(model);
      DiagramPanel.createOrShow(
        this.extensionUri,
        result.svg,
        editor.document.fileName,
        model,
        result.layout,
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to generate diagram: ${(err as Error).message}`,
      );
    }
  }
}
