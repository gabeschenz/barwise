import type { Connection } from "vscode-languageserver/node.js";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  OrmYamlSerializer,
  ValidationEngine,
  type Diagnostic as OrmDiagnostic,
} from "@fregma/core";

/**
 * Provides diagnostics for .orm.yaml files by running the core
 * validation engine and mapping results to LSP diagnostics.
 */
export class DiagnosticsProvider {
  private readonly connection: Connection;
  private readonly serializer = new OrmYamlSerializer();
  private readonly validationEngine = new ValidationEngine();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Parse the document, run validation, and send diagnostics.
   */
  validate(document: TextDocument): void {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    try {
      const model = this.serializer.deserialize(text);
      const ormDiagnostics = this.validationEngine.validate(model);

      for (const d of ormDiagnostics) {
        diagnostics.push({
          severity: mapSeverity(d.severity),
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          message: d.message,
          source: `fregma (${d.ruleId})`,
        });
      }
    } catch (err) {
      // Deserialization error -- report as a parse error.
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        message: (err as Error).message,
        source: "fregma (parse)",
      });
    }

    this.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics,
    });
  }
}

function mapSeverity(
  severity: OrmDiagnostic["severity"],
): DiagnosticSeverity {
  switch (severity) {
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
  }
}
