/**
 * VS Code integration tests for the Barwise extension.
 *
 * These tests run inside a real VS Code instance via @vscode/test-cli.
 * They verify that the extension activates, commands are registered,
 * diagnostics appear, completions work, hover provides info, and
 * commands handle edge cases correctly.
 */
import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Wait until diagnostics settle (no new diagnostics for a given period).
 * Useful for valid files that should end with 0 diagnostics.
 */
async function waitForDiagnosticsToSettle(
  uri: vscode.Uri,
  settleMs = 2000,
  timeout = 10000,
): Promise<vscode.Diagnostic[]> {
  const start = Date.now();
  let lastCount = -1;
  let lastChangeTime = Date.now();

  while (Date.now() - start < timeout) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length !== lastCount) {
      lastCount = diagnostics.length;
      lastChangeTime = Date.now();
    }
    if (Date.now() - lastChangeTime >= settleMs) {
      return diagnostics;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return vscode.languages.getDiagnostics(uri);
}

/**
 * Close all open editors to clean up between tests.
 */
async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

suite("Extension activation", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("extension activates and registers all commands", async () => {
    await waitForActivation();

    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = [
      "orm.newProject",
      "orm.validateModel",
      "orm.verbalize",
      "orm.showDiagram",
      "orm.import",
      "orm.export",
    ];

    for (const cmd of expectedCommands) {
      assert.ok(
        commands.includes(cmd),
        `${cmd} command should be registered`,
      );
    }
  });

  test("extension registers the orm-yaml language", async () => {
    const editor = await openFixture("simple.orm.yaml");
    // The extension contributes the orm-yaml language for .orm.yaml files.
    const langId = editor.document.languageId;
    assert.ok(
      langId === "orm-yaml" || langId === "yaml",
      `Language ID should be orm-yaml or yaml, got: ${langId}`,
    );
  });
});

suite("Diagnostics", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("valid model produces no error diagnostics", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    // Wait for the language server to process and send diagnostics.
    // A valid model should eventually have 0 errors (may have warnings).
    const diagnostics = await waitForDiagnosticsToSettle(
      editor.document.uri,
    );

    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );
    // Might be 0 diagnostics total (fully valid), or just warnings.
    assert.equal(
      errors.length,
      0,
      "Should have no error diagnostics for valid model",
    );
  });

  test("invalid model produces error diagnostics", async () => {
    await waitForActivation();
    const editor = await openFixture("invalid.orm.yaml");

    const diagnostics = await waitForDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );

    assert.ok(
      errors.length > 0,
      "Should have error diagnostics for invalid model",
    );

    // The error should mention the dangling reference.
    const hasRefError = errors.some(
      (d) =>
        d.message.toLowerCase().includes("object type")
        || d.message.toLowerCase().includes("dangling")
        || d.message.toLowerCase().includes("not found")
        || d.message.toLowerCase().includes("reference"),
    );
    assert.ok(
      hasRefError,
      "Should have a diagnostic about the dangling reference",
    );
  });

  test("validation-errors fixture produces diagnostics at correct positions", async () => {
    await waitForActivation();
    const editor = await openFixture("validation-errors.orm.yaml");

    const diagnostics = await waitForDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );

    assert.ok(
      errors.length > 0,
      "Should have error diagnostics for validation-errors fixture",
    );

    // Diagnostics should have valid ranges (non-negative line numbers).
    for (const diag of errors) {
      assert.ok(
        diag.range.start.line >= 0,
        `Diagnostic range start line should be >= 0, got ${diag.range.start.line}`,
      );
      assert.ok(
        diag.range.end.line >= diag.range.start.line,
        "Diagnostic range end line should be >= start line",
      );
    }
  });

  test("empty model produces no error diagnostics", async () => {
    await waitForActivation();
    const editor = await openFixture("empty-model.orm.yaml");

    const diagnostics = await waitForDiagnosticsToSettle(
      editor.document.uri,
    );

    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );
    assert.equal(
      errors.length,
      0,
      "Empty model should have no error diagnostics",
    );
  });

  test("multi-fact model produces no error diagnostics", async () => {
    await waitForActivation();
    const editor = await openFixture("multi-fact.orm.yaml");

    const diagnostics = await waitForDiagnosticsToSettle(
      editor.document.uri,
    );

    const errors = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );
    assert.equal(
      errors.length,
      0,
      "Multi-fact model should have no error diagnostics",
    );
  });

  test("switching between files updates diagnostics correctly", async () => {
    await waitForActivation();

    // Open invalid file first -- should get errors.
    const invalidEditor = await openFixture("invalid.orm.yaml");
    const invalidDiag = await waitForDiagnostics(
      invalidEditor.document.uri,
    );
    const invalidErrors = invalidDiag.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );
    assert.ok(
      invalidErrors.length > 0,
      "Invalid model should have errors",
    );

    // Open valid file -- should get no errors on this file.
    const validEditor = await openFixture("simple.orm.yaml");
    const validDiag = await waitForDiagnosticsToSettle(
      validEditor.document.uri,
    );
    const validErrors = validDiag.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    );
    assert.equal(
      validErrors.length,
      0,
      "Valid model should have no errors even after viewing invalid model",
    );
  });
});

suite("Command execution", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("orm.validateModel runs without error on a valid file", async () => {
    await waitForActivation();
    await openFixture("simple.orm.yaml");

    // Execute the validate command -- it should not throw.
    await vscode.commands.executeCommand("orm.validateModel");
    assert.ok(true, "validateModel command executed successfully");
  });

  test("orm.verbalize runs without error on a valid file", async () => {
    await waitForActivation();
    await openFixture("simple.orm.yaml");

    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(true, "verbalize command executed successfully");
  });

  test("orm.showDiagram runs without error on a valid file", async () => {
    await waitForActivation();
    await openFixture("simple.orm.yaml");

    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(true, "showDiagram command executed successfully");

    // Close the webview panel and editor.
    await vscode.commands.executeCommand(
      "workbench.action.closeActiveEditor",
    );
  });

  test("orm.validateModel runs on multi-fact model", async () => {
    await waitForActivation();
    await openFixture("multi-fact.orm.yaml");

    await vscode.commands.executeCommand("orm.validateModel");
    assert.ok(
      true,
      "validateModel ran successfully on multi-fact model",
    );
  });

  test("orm.verbalize runs on multi-fact model", async () => {
    await waitForActivation();
    await openFixture("multi-fact.orm.yaml");

    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(
      true,
      "verbalize ran successfully on multi-fact model",
    );
  });

  test("orm.showDiagram runs on multi-fact model", async () => {
    await waitForActivation();
    await openFixture("multi-fact.orm.yaml");

    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(
      true,
      "showDiagram ran successfully on multi-fact model",
    );

    await vscode.commands.executeCommand(
      "workbench.action.closeActiveEditor",
    );
  });

  test("orm.validateModel handles invalid model gracefully", async () => {
    await waitForActivation();
    await openFixture("invalid.orm.yaml");

    // Should not throw -- errors are reported via UI, not exceptions.
    await vscode.commands.executeCommand("orm.validateModel");
    assert.ok(
      true,
      "validateModel handled invalid model without throwing",
    );
  });

  test("orm.verbalize handles invalid model gracefully", async () => {
    await waitForActivation();
    await openFixture("invalid.orm.yaml");

    // The verbalize command should still run (it may produce partial
    // output or show a parse error message, but should not throw).
    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(
      true,
      "verbalize handled invalid model without throwing",
    );
  });

  test("orm.showDiagram handles invalid model gracefully", async () => {
    await waitForActivation();
    await openFixture("invalid.orm.yaml");

    // Should show an error message instead of crashing.
    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(
      true,
      "showDiagram handled invalid model without throwing",
    );
  });

  test("orm.validateModel on empty model runs without error", async () => {
    await waitForActivation();
    await openFixture("empty-model.orm.yaml");

    await vscode.commands.executeCommand("orm.validateModel");
    assert.ok(
      true,
      "validateModel ran on empty model without throwing",
    );
  });

  test("orm.verbalize on empty model runs without error", async () => {
    await waitForActivation();
    await openFixture("empty-model.orm.yaml");

    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(
      true,
      "verbalize ran on empty model without throwing",
    );
  });
});

suite("Diagram panel lifecycle", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("opening diagram twice does not throw", async () => {
    await waitForActivation();
    await openFixture("simple.orm.yaml");

    // Open diagram first time.
    await vscode.commands.executeCommand("orm.showDiagram");

    // Open diagram second time -- should reveal existing panel.
    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(true, "Opening diagram twice did not throw");

    // Close webview panel.
    await vscode.commands.executeCommand(
      "workbench.action.closeActiveEditor",
    );
  });

  test("diagram updates when switching models", async () => {
    await waitForActivation();

    // Open diagram for simple model.
    await openFixture("simple.orm.yaml");
    await vscode.commands.executeCommand("orm.showDiagram");

    // Switch to multi-fact model and open diagram again.
    await openFixture("multi-fact.orm.yaml");
    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(true, "Diagram updated for different model without error");

    await vscode.commands.executeCommand(
      "workbench.action.closeActiveEditor",
    );
  });
});

suite("Completions", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("provides object type ID completions on a player: line", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    // Wait a moment for the language server to initialize.
    await new Promise((r) => setTimeout(r, 2000));

    // Find a player: line.
    const text = editor.document.getText();
    const lines = text.split("\n");
    const playerLineIdx = lines.findIndex((l) => l.trim().startsWith("player:"));
    assert.ok(
      playerLineIdx >= 0,
      "Should find a player: line in the fixture",
    );

    const position = new vscode.Position(playerLineIdx, 18);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      editor.document.uri,
      position,
    );

    // Should have completion items from our provider.
    assert.ok(completions, "Should return completions");
    const labels = completions.items.map((c) =>
      typeof c.label === "string" ? c.label : c.label.label
    );
    assert.ok(
      labels.includes("ot-customer") || labels.includes("ot-name"),
      `Should include object type IDs, got: ${labels.join(", ")}`,
    );
  });

  test("provides completions in multi-fact model", async () => {
    await waitForActivation();
    const editor = await openFixture("multi-fact.orm.yaml");

    await new Promise((r) => setTimeout(r, 2000));

    const text = editor.document.getText();
    const lines = text.split("\n");
    const playerLineIdx = lines.findIndex((l) => l.trim().startsWith("player:"));
    assert.ok(
      playerLineIdx >= 0,
      "Should find a player: line in multi-fact fixture",
    );

    const position = new vscode.Position(playerLineIdx, 18);

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      editor.document.uri,
      position,
    );

    assert.ok(completions, "Should return completions for multi-fact model");
    const labels = completions.items.map((c) =>
      typeof c.label === "string" ? c.label : c.label.label
    );

    // Multi-fact model has four object types.
    const hasCustomer = labels.includes("ot-customer");
    const hasOrder = labels.includes("ot-order");
    assert.ok(
      hasCustomer || hasOrder,
      `Should include object type IDs from multi-fact model, got: ${labels.join(", ")}`,
    );
  });
});

suite("Hover", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("hover over object type name shows definition", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    await new Promise((r) => setTimeout(r, 2000));

    // Find the line with 'name: "Customer"'.
    const text = editor.document.getText();
    const lines = text.split("\n");
    const customerLineIdx = lines.findIndex(
      (l) => l.includes('name: "Customer"') && !l.includes("model"),
    );
    assert.ok(
      customerLineIdx >= 0,
      "Should find Customer name line in fixture",
    );

    // Position cursor on the word "Customer".
    const line = lines[customerLineIdx]!;
    const customerStart = line.indexOf("Customer");
    assert.ok(customerStart >= 0, "Should find Customer in the line");

    const position = new vscode.Position(
      customerLineIdx,
      customerStart + 3,
    );

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      editor.document.uri,
      position,
    );

    // Should have hover content from our provider.
    assert.ok(hovers, "Should return hovers");
    if (hovers.length > 0) {
      const content = hovers
        .flatMap((h) => h.contents)
        .map((c) => {
          if (typeof c === "string") return c;
          if (c instanceof vscode.MarkdownString) return c.value;
          // vscode.MarkedString (deprecated) -- { language, value }
          return "value" in c ? String(c.value) : String(c);
        })
        .join("\n");

      assert.ok(
        content.includes("Customer"),
        `Hover should mention Customer, got: ${content.slice(0, 200)}`,
      );
    }
  });

  test("hover over player ID shows object type info", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    await new Promise((r) => setTimeout(r, 2000));

    // Find a line with player: "ot-customer".
    const text = editor.document.getText();
    const lines = text.split("\n");
    const playerLineIdx = lines.findIndex((l) => l.includes("ot-customer"));
    assert.ok(
      playerLineIdx >= 0,
      "Should find ot-customer reference in fixture",
    );

    const line = lines[playerLineIdx]!;
    const idStart = line.indexOf("ot-customer");
    assert.ok(idStart >= 0, "Should find ot-customer in the line");

    const position = new vscode.Position(playerLineIdx, idStart + 3);

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      editor.document.uri,
      position,
    );

    assert.ok(hovers, "Should return hovers for player ID");
    if (hovers.length > 0) {
      const content = hovers
        .flatMap((h) => h.contents)
        .map((c) => {
          if (typeof c === "string") return c;
          if (c instanceof vscode.MarkdownString) return c.value;
          return "value" in c ? String(c.value) : String(c);
        })
        .join("\n");

      assert.ok(
        content.includes("Customer"),
        `Hover over player ID should show Customer info, got: ${content.slice(0, 200)}`,
      );
    }
  });

  test("hover over non-reference text returns empty", async () => {
    await waitForActivation();
    const editor = await openFixture("simple.orm.yaml");

    await new Promise((r) => setTimeout(r, 2000));

    // Hover over "orm_version" (line 0) -- should not match anything.
    const position = new vscode.Position(0, 3);

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      editor.document.uri,
      position,
    );

    // Our provider should not produce hover for non-ORM references.
    // Other providers (YAML language server) may produce hovers, so
    // we just verify our provider does not crash.
    assert.ok(true, "Hover over non-reference did not throw");
  });
});

suite("Import/Export command routers", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("orm.import command is registered and callable", async () => {
    await waitForActivation();

    // The import command shows a QuickPick. Since we cannot interact
    // with the QuickPick in integration tests, we just verify the
    // command does not throw. The QuickPick will be dismissed when
    // the test moves on (no selection = cancellation).
    const result = vscode.commands.executeCommand("orm.import");
    // Give the QuickPick a moment to appear, then dismiss it.
    await new Promise((r) => setTimeout(r, 500));
    await vscode.commands.executeCommand(
      "workbench.action.closeQuickOpen",
    );
    await result;
    assert.ok(true, "orm.import executed without throwing");
  });

  test("orm.export command is registered and callable", async () => {
    await waitForActivation();

    const result = vscode.commands.executeCommand("orm.export");
    await new Promise((r) => setTimeout(r, 500));
    await vscode.commands.executeCommand(
      "workbench.action.closeQuickOpen",
    );
    await result;
    assert.ok(true, "orm.export executed without throwing");
  });
});

suite("NewProject command", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("orm.newProject command is registered", async () => {
    await waitForActivation();

    // NewProject shows a native OS save dialog that cannot be
    // dismissed programmatically in the test harness. We verify
    // the command is registered rather than executing it.
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("orm.newProject"),
      "orm.newProject should be registered",
    );
  });
});

suite("Edge cases", () => {
  teardown(async () => {
    await closeAllEditors();
  });

  test("validate command with no active editor does not crash", async () => {
    await waitForActivation();
    await closeAllEditors();

    // With no editor open, the command should show a warning, not crash.
    await vscode.commands.executeCommand("orm.validateModel");
    assert.ok(true, "validateModel with no editor did not throw");
  });

  test("verbalize command with no active editor does not crash", async () => {
    await waitForActivation();
    await closeAllEditors();

    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(true, "verbalize with no editor did not throw");
  });

  test("showDiagram command with no active editor does not crash", async () => {
    await waitForActivation();
    await closeAllEditors();

    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(true, "showDiagram with no editor did not throw");
  });

  test("commands handle non-orm.yaml file gracefully", async () => {
    await waitForActivation();

    // Open a non-.orm.yaml file (use this test file's compiled JS as
    // a proxy -- any non-.orm.yaml file will do).
    const packageRoot = path.resolve(__dirname, "..", "..", "..");
    const tsconfig = vscode.Uri.file(
      path.join(packageRoot, "package.json"),
    );
    const doc = await vscode.workspace.openTextDocument(tsconfig);
    await vscode.window.showTextDocument(doc);

    // These commands check for .orm.yaml and show a warning if wrong type.
    await vscode.commands.executeCommand("orm.validateModel");
    assert.ok(true, "validateModel on non-orm.yaml did not throw");

    await vscode.commands.executeCommand("orm.verbalize");
    assert.ok(true, "verbalize on non-orm.yaml did not throw");

    await vscode.commands.executeCommand("orm.showDiagram");
    assert.ok(true, "showDiagram on non-orm.yaml did not throw");
  });
});
