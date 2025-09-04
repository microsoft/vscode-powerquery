// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import * as CommandFn from "./commands";
import { CommandConstant, ConfigurationConstant } from "./constants";
import { LibrarySymbolClient } from "./librarySymbolClient";
import { LibrarySymbolManager } from "./librarySymbolManager";
import { PowerQueryApi } from "./powerQueryApi";

let client: LC.LanguageClient;
let librarySymbolClient: LibrarySymbolClient;
let librarySymbolManager: LibrarySymbolManager;

export async function activate(context: vscode.ExtensionContext): Promise<PowerQueryApi> {
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand(CommandConstant.ExtractDataflowDocument, CommandFn.extractDataflowDocument),
        vscode.commands.registerTextEditorCommand(CommandConstant.EscapeJsonText, CommandFn.escapeJsonText),
        vscode.commands.registerTextEditorCommand(CommandConstant.EscapeMText, CommandFn.escapeMText),
        vscode.commands.registerTextEditorCommand(CommandConstant.UnescapeJsonText, CommandFn.unescapeJsonText),
        vscode.commands.registerTextEditorCommand(CommandConstant.UnescapeMText, CommandFn.unescapeMText),
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
            { scheme: "file", language: "powerquery" },
            { scheme: "untitled", language: "powerquery" },
        ],
        outputChannel: vscode.window.createOutputChannel("Power Query"),
        synchronize: {
            // Synchronize the setting section 'powerquery' to the server
            configurationSection: "powerquery",
        },
    };

    // Create the language client and start the client.
    client = new LC.LanguageClient("powerquery", "Power Query", serverOptions, clientOptions);

    // Start the client. This will also launch the server.
    await client.start();

    // TODO: Move this to the LSP based API.
    // context.subscriptions.push(
    //     vscode.languages.registerDocumentSemanticTokensProvider(
    //         { language: "powerquery" },
    //         Subscriptions.createDocumentSemanticTokensProvider(client),
    //         Subscriptions.SemanticTokensLegend,
    //     ),
    // );

    librarySymbolClient = new LibrarySymbolClient(client);
    librarySymbolManager = new LibrarySymbolManager(librarySymbolClient, client);

    await configureSymbolDirectories();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
            const symbolDirs: string = ConfigurationConstant.BasePath.concat(
                ".",
                ConfigurationConstant.AdditionalSymbolsDirectories,
            );

            if (event.affectsConfiguration(symbolDirs)) {
                await configureSymbolDirectories();
            }
        }),
    );

    return Object.freeze(librarySymbolClient);
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

async function configureSymbolDirectories(): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ConfigurationConstant.BasePath);

    const additionalSymbolsDirectories: string[] | undefined = config.get(
        ConfigurationConstant.AdditionalSymbolsDirectories,
    );

    // TODO: Should we fix/remove invalid and malformed directory path values?
    // For example, a quoted path "c:\path\to\file" will be considered invalid and reported as an error.
    // We could modify values and write them back to the original config locations.

    await librarySymbolManager.refreshSymbolDirectories(additionalSymbolsDirectories ?? []);

    // TODO: Configure file system watchers to detect library file changes.
}
