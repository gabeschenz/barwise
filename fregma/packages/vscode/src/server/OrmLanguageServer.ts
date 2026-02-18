import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  Hover,
  TextDocumentPositionParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticsProvider } from "./DiagnosticsProvider.js";
import { CompletionProvider } from "./CompletionProvider.js";
import { HoverProvider } from "./HoverProvider.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let diagnosticsProvider: DiagnosticsProvider;
let completionProvider: CompletionProvider;
let hoverProvider: HoverProvider;

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  diagnosticsProvider = new DiagnosticsProvider(connection);
  completionProvider = new CompletionProvider();
  hoverProvider = new HoverProvider();

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['"', ":", " "],
      },
      hoverProvider: true,
    },
  };
});

// Validate on open and change.
documents.onDidChangeContent((change) => {
  if (isOrmYaml(change.document.uri)) {
    diagnosticsProvider.validate(change.document);
  }
});

documents.onDidOpen((event) => {
  if (isOrmYaml(event.document.uri)) {
    diagnosticsProvider.validate(event.document);
  }
});

// Completion.
connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const doc = documents.get(params.textUri ?? params.textDocument.uri);
    if (!doc || !isOrmYaml(doc.uri)) return [];
    return completionProvider.provideCompletions(doc, params.position);
  },
);

// Hover.
connection.onHover(
  (params: TextDocumentPositionParams): Hover | null => {
    const doc = documents.get(params.textUri ?? params.textDocument.uri);
    if (!doc || !isOrmYaml(doc.uri)) return null;
    return hoverProvider.provideHover(doc, params.position);
  },
);

function isOrmYaml(uri: string): boolean {
  return uri.endsWith(".orm.yaml");
}

documents.listen(connection);
connection.listen();
