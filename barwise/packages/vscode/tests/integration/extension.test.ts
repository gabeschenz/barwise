/**
 * VS Code integration tests for the Barwise extension.
 *
 * These tests run inside a real VS Code instance via @vscode/test-cli.
 * They verify that the extension activates, commands are registered,
 * diagnostics appear, and completions work end-to-end.
 */
import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import * as path from "node:path";

/**
 * Wait for the extension to activate by checking for a known command.
 */
async function waitForActivation(timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const commands = await vscode.commands.getCommands(true);
    if (commands.includes("orm.validateModel")) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Extension did not activate within timeout");
}

/**
 * Open a fixture file and wait for it to be ready.
 *
 * __dirname at runtime points to dist/tests/integration/, so we walk
 * up to the package root (dist -> tests -> integration -> root) and
 * then into tests/fixtures/.
 */
async function openFixture(name: string): Promise<vscode.TextEditor> {
  // Go up from dist/tests/integration/ to the package root.
  const packageRoot = path.resolve(__dirname, "..", "..", "..");
  const fixtureDir = path.join(packageRoot, "tests", "fixtures");
  const uri = vscode.Uri.file(path.join(fixtureDir, name));
  const doc = await vscode.workspace.openTextDocument(uri);
  return vscode.window.showTextDocument(doc);
}

/**
 * Wait for diagnostics to appear on a document.
 */
async function waitForDiagnostics(
  uri: vscode.Uri,
  timeout = 10000,
): Promise<vscode.Diagnostic[]> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length > 0) return diagnostics;
    await new Promise((r) => setTimeout(r, 200));
  }
  return vscode.languages.getDiagnostics(uri);
}

suite("Extension activation", () => {
  test("extension activates and registers commands", async () => {
    await waitForActivation();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("orm.newProject"), "orm.newProject command should be registered");
    assert.ok(commands.includes("orm.validateModel"), "orm.validateModel should be registered");
    assert.ok(commands.includes("orm.verbalize"), "orm.verbalize should be registered");
    assert.ok(commands.includes("orm.showDiagram"), "orm.showDiagram should be registered");
    assert.ok(commands.includes("orm.importTranscript"), "orm.importTranscript should be registered");
  });
});

suite("Diagnostics", () => {
  test("valid model produces no error diagnostics", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    // Wait for the language server to process and send diagnostics.
    // A valid model should eventually have 0 errors (may have warnings).
    const diagnostics = await waitForDiagnostics(editor.document.uri);

    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );
    // Might be 0 diagnostics total (fully valid), or just warnings.
    assert.equal(errors.length, 0, "Should have no error diagnostics for valid model");

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("invalid model produces error diagnostics", async () => {
    await waitForActivation();
    const editor = await openFixture("invalid.orm.yaml");

    const diagnostics = await waitForDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );

    assert.ok(errors.length > 0, "Should have error diagnostics for invalid model");

    // The error should mention the dangling reference.
    const hasRefError = errors.some((d) =>
      d.message.toLowerCase().includes("object type") ||
      d.message.toLowerCase().includes("dangling") ||
      d.message.toLowerCase().includes("not found") ||
      d.message.toLowerCase().includes("reference"),
    );
    assert.ok(hasRefError, "Should have a diagnostic about the dangling reference");

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});

suite("Command execution", () => {
  test("orm.validateModel runs without error on a valid file", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    // Execute the validate command -- it should not throw.
    await vscode.commands.executeCommand("orm.validateModel");

    // If we got here without an exception, the command executed.
    assert.ok(true, "validateModel command executed successfully");

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("orm.verbalize runs without error on a valid file", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(true, "verbalize command executed successfully");

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("orm.showDiagram runs without error on a valid file", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(true, "showDiagram command executed successfully");

    // Close the webview panel and editor.
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});

suite("Completions", () => {
  test("provides object type ID completions on a player: line", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    // Wait a moment for the language server to initialize.
    await new Promise((r) => setTimeout(r, 2000));

    // Find a player: line.
    const text = editor.document.getText();
    const lines = text.split("\n");
    const playerLineIdx = lines.findIndex((l) => l.trim().startsWith("player:"));
    assert.ok(playerLineIdx >= 0, "Should find a player: line in the fixture");

    const position = new vscode.Position(playerLineIdx, 18);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      editor.document.uri,
      position,
    );

    // Should have completion items from our provider.
    assert.ok(completions, "Should return completions");
    const labels = completions.items.map((c) =>
      typeof c.label === "string" ? c.label : c.label.label,
    );
    assert.ok(
      labels.includes("ot-customer") || labels.includes("ot-name"),
      `Should include object type IDs, got: ${labels.join(", ")}`,
    );

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});
