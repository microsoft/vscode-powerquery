// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import * as CommandFn from "./commands";
import * as Subscriptions from "./subscriptions";
import { CommandConstants } from "./constants";
import { LibrarySymbolClient } from "./librarySymbolClient";
import { PowerQueryApi } from "./vscode-powerquery.api";
import { processSymbolDirectories } from "./symbolUtils";

const commands: vscode.Disposable[] = [];
const symbolDirectoryWatchers: Map<string, vscode.Disposable> = new Map<string, vscode.Disposable>();

let client: LC.LanguageClient;
let librarySymbolClient: LibrarySymbolClient;
// let registeredSymbolModules: string[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<PowerQueryApi> {
    // Register commands
    // TODO: Dispose commands through context.subscriptions.
    commands.push(vscode.commands.registerTextEditorCommand(CommandConstants.EscapeJsonText, CommandFn.escapeJsonText));
    commands.push(vscode.commands.registerTextEditorCommand(CommandConstants.EscapeMText, CommandFn.escapeMText));

    commands.push(
        vscode.commands.registerTextEditorCommand(CommandConstants.UnescapeJsonText, CommandFn.unescapeJsonText),
    );

    commands.push(vscode.commands.registerTextEditorCommand(CommandConstants.UnescapeMText, CommandFn.unescapeMText));

    commands.push(
        vscode.commands.registerCommand(CommandConstants.ExtractDataflowDocument, CommandFn.extractDataflowDocument),
    );

    // The server is implemented in node
    const serverModule: string = context.asAbsolutePath(path.join("server", "dist", "server.js"));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions: LC.ForkOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: LC.ServerOptions = {
        run: { module: serverModule, transport: LC.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: LC.TransportKind.ipc,
            options: debugOptions,
        },
    };

    // Options to control the language client
    const clientOptions: LC.LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [
            {
                scheme: "file",
                language: "powerquery",
            },
            {
                scheme: "untitled",
                language: "powerquery",
            },
        ],
    };

    // Create the language client and start the client.
    client = new LC.LanguageClient("powerquery", "Power Query", serverOptions, clientOptions);

    // Start the client. This will also launch the server.
    await client.start();

    librarySymbolClient = new LibrarySymbolClient(client);

    // TODO: Move this to the LSP based API.
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: "powerquery" },
            Subscriptions.createDocumentSemanticTokensProvider(client),
            Subscriptions.SemanticTokensLegend,
        ),
    );

    // Read initial configuration and configure listener. This needs to be done after the server is running.
    await processSymbolDirectories(librarySymbolClient);

    return Object.freeze(librarySymbolClient);
}

export function deactivate(): Thenable<void> | undefined {
    if (commands.length > 0) {
        commands.forEach((disposable: vscode.Disposable) => disposable.dispose());
        commands.length = 0;
    }

    disposeSymbolWatchers();

    return client?.stop();
}

function disposeSymbolWatchers(): void {
    symbolDirectoryWatchers.forEach((item: vscode.Disposable, _: string) => item.dispose());
    symbolDirectoryWatchers.clear();
}
