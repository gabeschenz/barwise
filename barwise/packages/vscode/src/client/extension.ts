import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";
import { NewProjectCommand } from "../commands/NewProjectCommand.js";
import { ValidateModelCommand } from "../commands/ValidateModelCommand.js";
import { VerbalizeCommand } from "../commands/VerbalizeCommand.js";
import { ShowDiagramCommand } from "../commands/ShowDiagramCommand.js";
import { ImportCommand } from "../commands/ImportCommand.js";
import { ExportCommand } from "../commands/ExportCommand.js";
import { registerMcpServerProvider } from "../mcp/McpServerProvider.js";
import { registerLanguageModelTools } from "../mcp/ToolRegistration.js";

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
    "Barwise ORM Language Server",
    serverOptions,
    clientOptions,
  );

  client.start();

  // Register commands.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "orm.newProject",
      () => new NewProjectCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "orm.validateModel",
      () => new ValidateModelCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "orm.verbalize",
      () => new VerbalizeCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "orm.showDiagram",
      () => new ShowDiagramCommand(context.extensionUri).execute(),
    ),
    vscode.commands.registerCommand(
      "orm.import",
      () => new ImportCommand().execute(),
    ),
    vscode.commands.registerCommand(
      "orm.export",
      () => new ExportCommand().execute(),
    ),
    registerMcpServerProvider(context),
  );

  // Register Language Model Tools (vscode.lm.registerTool) so that
  // Copilot Chat and other AI features can invoke barwise tools
  // directly in the extension host process (with Copilot access).
  registerLanguageModelTools(context);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
