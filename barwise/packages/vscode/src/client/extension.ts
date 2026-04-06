import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";
import { registerChatParticipant } from "../chat/ChatParticipant.js";
import { ExportCommand } from "../commands/ExportCommand.js";
import { ImportCommand } from "../commands/ImportCommand.js";
import { NewProjectCommand } from "../commands/NewProjectCommand.js";
import { ShowDiagramCommand } from "../commands/ShowDiagramCommand.js";
import { ValidateModelCommand } from "../commands/ValidateModelCommand.js";
import { VerbalizeCommand } from "../commands/VerbalizeCommand.js";
import { DiagramPanel } from "../diagram/DiagramPanel.js";
import { registerMcpServerProvider } from "../mcp/McpServerProvider.js";
import { registerLanguageModelTools } from "../mcp/ToolRegistration.js";
import { ModelTreeProvider } from "../sidebar/ModelTreeProvider.js";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext): void {
  // Start language server.
  const serverModule = context.asAbsolutePath(
    path.join("dist", "server", "OrmLanguageServer.js"),
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", pattern: "**/*.orm.yaml" },
    ],
  };

  client = new LanguageClient(
    "barwiseOrmLanguageServer",
    "Barwise Language Server",
    serverOptions,
    clientOptions,
  );

  client.start();

  // Register commands.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "barwise.newProject",
      () => new NewProjectCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "barwise.validateModel",
      () => new ValidateModelCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "barwise.verbalize",
      () => new VerbalizeCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "barwise.showDiagram",
      () => new ShowDiagramCommand(context.extensionUri).execute(),
    ),
    vscode.commands.registerCommand(
      "barwise.import",
      () => new ImportCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "barwise.export",
      () => new ExportCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "barwise.highlightInDiagram",
      (elementId: string, kind: string) => {
        DiagramPanel.highlightElement(elementId, kind);
      },
    ),
    vscode.commands.registerCommand(
      "barwise.copyElementName",
      (treeItem: vscode.TreeItem) => {
        const name = typeof treeItem?.label === "string"
          ? treeItem.label
          : treeItem?.label?.label;
        if (name) {
          void vscode.env.clipboard.writeText(name);
          vscode.window.showInformationMessage(`Copied: ${name}`);
        }
      },
    ),
    registerMcpServerProvider(context),
  );

  // Register the sidebar model browser tree view.
  const modelTree = new ModelTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("barwise.modelTree", modelTree),
  );

  // Refresh the tree when the active editor changes to an .orm.yaml file.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.fileName.endsWith(".orm.yaml")) {
        modelTree.refresh(editor.document);
      }
    }),
  );

  // Refresh the tree when an .orm.yaml document is saved.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith(".orm.yaml")) {
        modelTree.refresh(doc);
      }
    }),
  );

  // Seed with the active editor if it's already an .orm.yaml file.
  if (vscode.window.activeTextEditor?.document.fileName.endsWith(".orm.yaml")) {
    modelTree.refresh(vscode.window.activeTextEditor.document);
  }

  // Register Language Model Tools (vscode.lm.registerTool) so that
  // Copilot Chat and other AI features can invoke barwise tools
  // directly in the extension host process (with Copilot access).
  registerLanguageModelTools(context);

  // Register the @barwise chat participant so users can invoke barwise
  // directly in Copilot Chat (e.g. "@barwise import this transcript").
  registerChatParticipant(context);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
