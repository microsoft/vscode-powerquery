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
    const outputChannel: vscode.LogOutputChannel = vscode.window.createOutputChannel("Power Query", { log: true });

    const clientOptions: LC.LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [
            { scheme: "file", language: "powerquery" },
            { scheme: "untitled", language: "powerquery" },
        ],
        outputChannel,
    };

    // Create the language client and start the client.
    client = new LC.LanguageClient("powerquery", "Power Query", serverOptions, clientOptions);

    // Start the client. This will also launch the server.
    await client.start();

    librarySymbolClient = new LibrarySymbolClient(client);
    librarySymbolManager = new LibrarySymbolManager(librarySymbolClient, client);

    await configureAllFolderSymbolDirectories();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
            const symbolDirs: string = ConfigurationConstant.BasePath.concat(
                ".",
                ConfigurationConstant.AdditionalSymbolsDirectories,
            );

            if (event.affectsConfiguration(symbolDirs)) {
                await configureAllFolderSymbolDirectories();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(async (event: vscode.WorkspaceFoldersChangeEvent) => {
            await Promise.all(
                event.removed.map((folder: vscode.WorkspaceFolder) =>
                    librarySymbolManager.removeSymbolsForFolder(folder.uri.toString()),
                ),
            );

            await Promise.all(
                event.added.map((folder: vscode.WorkspaceFolder) => configureSymbolDirectoriesForFolder(folder)),
            );
        }),
    );

    return Object.freeze(librarySymbolClient);
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

async function configureAllFolderSymbolDirectories(): Promise<void> {
    const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        // No workspace folders — read global config
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(ConfigurationConstant.BasePath);

        const additionalSymbolsDirectories: string[] | undefined = config.get(
            ConfigurationConstant.AdditionalSymbolsDirectories,
        );

        await librarySymbolManager.refreshSymbolDirectories(additionalSymbolsDirectories ?? []);

        return;
    }

    // Clear any previously-registered global or stale folder symbols before
    // rebuilding the current workspace-folder registrations.
    await librarySymbolManager.removeAllSymbols();

    await Promise.all(folders.map((folder: vscode.WorkspaceFolder) => configureSymbolDirectoriesForFolder(folder)));
}

async function configureSymbolDirectoriesForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
        ConfigurationConstant.BasePath,
        folder.uri,
    );

    const additionalSymbolsDirectories: string[] | undefined = config.get(
        ConfigurationConstant.AdditionalSymbolsDirectories,
    );

    await librarySymbolManager.refreshSymbolDirectoriesForFolder(
        folder.uri.toString(),
        additionalSymbolsDirectories ?? [],
    );
}
