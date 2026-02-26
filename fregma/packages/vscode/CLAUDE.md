# fregma-vscode

VS Code extension that wires the platform-independent packages
(`@fregma/core`, `@fregma/diagram`, `@fregma/llm`) into the editor.
This package is the thin integration layer -- business logic lives in
the core packages.

## Dependency Rule

This is the ONLY package that may depend on the `vscode` module.
All ORM domain logic, validation, mapping, verbalization, and
serialization must stay in `@fregma/core`. Diagram generation logic
stays in `@fregma/diagram`. LLM extraction logic stays in
`@fregma/llm`.

If you find yourself writing model logic or validation rules here,
it belongs in core instead.

## Package Layout

```
src/
  client/
    extension.ts              VS Code activate/deactivate entry point
  server/
    OrmLanguageServer.ts      LSP server (diagnostics, completion, hover)
    CompletionProvider.ts     Autocomplete for .orm.yaml files
    DiagnosticsProvider.ts    Maps validation diagnostics to LSP
    HoverProvider.ts          Hover info for object type references
  commands/
    NewProjectCommand.ts      orm.newProject -- scaffold a new .orm.yaml
    ValidateModelCommand.ts   orm.validateModel -- full validation
    VerbalizeCommand.ts       orm.verbalize -- generate verbalization report
    ShowDiagramCommand.ts     orm.showDiagram -- open diagram webview panel
    ImportTranscriptCommand.ts orm.importTranscript -- LLM transcript extraction
  diagram/
    DiagramPanel.ts           VS Code Webview panel host for SVG diagrams
  llm/
    CopilotLlmClient.ts      LlmClient implementation using GitHub Copilot chat API
```

## Build

This package uses **esbuild** (not `tsc`) for production builds. The
build produces two bundles:

- `dist/client/extension.js` -- the extension entry point
- `dist/server/OrmLanguageServer.js` -- the language server process

```sh
node esbuild.mjs            # build both bundles
npx tsc --noEmit             # type-check only (uses tsconfig.json with Bundler resolution)
```

The tsconfig uses `moduleResolution: "Bundler"` (not `NodeNext` like
the other packages) because esbuild handles module resolution at
bundle time.

## Key Conventions

- The extension uses the Language Server Protocol (LSP). The server
  runs in a separate process and communicates via JSON-RPC.
- `vscode` is an external in the esbuild config -- it is provided by
  the VS Code runtime, not bundled.
- The `CopilotLlmClient` implements the `LlmClient` interface from
  `@fregma/llm` using the VS Code Copilot chat API. This is the
  default provider so users do not need an API key.
- Extension settings are declared in `package.json` under
  `contributes.configuration` (LLM provider, API key, model selection).

## Testing

No automated tests yet. VS Code integration tests would use
`@vscode/test-electron`.

## Dependencies

| Direction | Package | What is used |
|-----------|---------|--------------|
| Upstream  | `@fregma/core` | Model types, validation, verbalization, serialization, mapping |
| Upstream  | `@fregma/diagram` | `generateDiagram` for webview SVG rendering |
| Upstream  | `@fregma/llm` | `processTranscript`, `LlmClient` interface, extraction types |
| External  | `vscode` | Editor API (provided at runtime, not bundled) |
| External  | `vscode-languageserver/client` | LSP protocol implementation |
