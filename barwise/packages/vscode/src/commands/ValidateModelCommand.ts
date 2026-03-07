import * as vscode from "vscode";
import {
  OrmYamlSerializer,
  ValidationEngine,
} from "@barwise/core";

/**
 * Runs full validation on the active .orm.yaml file and displays
 * results in the output channel.
 */
export class ValidateModelCommand {
  private readonly serializer = new OrmYamlSerializer();
  private readonly engine = new ValidationEngine();

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor.");
      return;
    }

    if (!editor.document.uri.fsPath.endsWith(".orm.yaml")) {
      vscode.window.showWarningMessage(
        "Active file is not an .orm.yaml file.",
      );
      return;
    }

    const text = editor.document.getText();
    const channel = vscode.window.createOutputChannel("ORM Validation");
    channel.clear();
    channel.show();

    try {
      const model = this.serializer.deserialize(text);
      const diagnostics = this.engine.validate(model);

      if (diagnostics.length === 0) {
        channel.appendLine("Model is valid. No issues found.");
        vscode.window.showInformationMessage(
          "ORM model is valid.",
        );
        return;
      }

      const errors = diagnostics.filter(
        (d) => d.severity === "error",
      );
      const warnings = diagnostics.filter(
        (d) => d.severity === "warning",
      );
      const infos = diagnostics.filter(
        (d) => d.severity === "info",
      );

      channel.appendLine(
        `Validation complete: ${errors.length} error(s), ` +
          `${warnings.length} warning(s), ${infos.length} info(s)`,
      );
      channel.appendLine("");

      for (const d of diagnostics) {
        channel.appendLine(
          `[${d.severity.toUpperCase()}] ${d.message} (${d.ruleId})`,
        );
      }

      if (errors.length > 0) {
        vscode.window.showErrorMessage(
          `ORM validation: ${errors.length} error(s) found.`,
        );
      } else {
        vscode.window.showWarningMessage(
          `ORM validation: ${warnings.length} warning(s) found.`,
        );
      }
    } catch (err) {
      channel.appendLine(`Parse error: ${(err as Error).message}`);
      vscode.window.showErrorMessage(
        `ORM parse error: ${(err as Error).message}`,
      );
    }
  }
}
