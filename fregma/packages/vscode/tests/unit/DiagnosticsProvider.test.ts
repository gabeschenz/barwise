/**
 * Unit tests for DiagnosticsProvider.
 *
 * Tests the diagnostic mapping logic without requiring a running VS Code
 * instance. We mock the LSP Connection and construct TextDocument objects
 * directly from the vscode-languageserver-textdocument package.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticsProvider } from "../../src/server/DiagnosticsProvider.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, "..", "fixtures", name), "utf-8");
}

function makeDocument(content: string, uri = "file:///test/model.orm.yaml"): TextDocument {
  return TextDocument.create(uri, "orm-yaml", 1, content);
}

function makeMockConnection() {
  return {
    sendDiagnostics: vi.fn(),
  };
}

describe("DiagnosticsProvider", () => {
  let connection: ReturnType<typeof makeMockConnection>;
  let provider: DiagnosticsProvider;

  beforeEach(() => {
    connection = makeMockConnection();
    // DiagnosticsProvider expects a Connection, but we only use sendDiagnostics.
    provider = new DiagnosticsProvider(connection as never);
  });

  it("sends diagnostics for a valid model", () => {
    const doc = makeDocument(loadFixture("simple.orm.yaml"));
    provider.validate(doc);

    expect(connection.sendDiagnostics).toHaveBeenCalledOnce();
    const call = connection.sendDiagnostics.mock.calls[0]![0]!;
    expect(call.uri).toBe(doc.uri);
    // A valid simple model should have no errors (may have warnings).
    const errors = call.diagnostics.filter(
      (d: { severity: number }) => d.severity === 1, // DiagnosticSeverity.Error
    );
    expect(errors).toHaveLength(0);
  });

  it("sends error diagnostics for a model with dangling references", () => {
    const doc = makeDocument(loadFixture("invalid.orm.yaml"));
    provider.validate(doc);

    expect(connection.sendDiagnostics).toHaveBeenCalledOnce();
    const call = connection.sendDiagnostics.mock.calls[0]![0]!;
    // Should have at least one error for the dangling role player.
    const errors = call.diagnostics.filter(
      (d: { severity: number }) => d.severity === 1,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("sends a parse error for malformed YAML", () => {
    const doc = makeDocument("{{{{not valid yaml at all");
    provider.validate(doc);

    expect(connection.sendDiagnostics).toHaveBeenCalledOnce();
    const call = connection.sendDiagnostics.mock.calls[0]![0]!;
    expect(call.diagnostics).toHaveLength(1);
    expect(call.diagnostics[0].severity).toBe(1); // Error
    expect(call.diagnostics[0].source).toBe("fregma (parse)");
  });

  it("includes the rule ID in the source field", () => {
    const doc = makeDocument(loadFixture("invalid.orm.yaml"));
    provider.validate(doc);

    const call = connection.sendDiagnostics.mock.calls[0]![0]!;
    for (const d of call.diagnostics) {
      expect(d.source).toMatch(/^fregma \(/);
    }
  });

  it("maps severity levels correctly", () => {
    // The invalid fixture should produce at least errors.
    const doc = makeDocument(loadFixture("invalid.orm.yaml"));
    provider.validate(doc);

    const call = connection.sendDiagnostics.mock.calls[0]![0]!;
    for (const d of call.diagnostics) {
      // DiagnosticSeverity: Error=1, Warning=2, Information=3
      expect([1, 2, 3]).toContain(d.severity);
    }
  });
});
