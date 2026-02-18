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
    "fregmaOrmLanguageServer",
    "Fregma ORM Language Server",
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
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
