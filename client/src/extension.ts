// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import * as CommandFn from "./commands";
import * as Subscriptions from "./subscriptions";
import { LibraryJson, PowerQueryApi } from "./vscode-powerquery.api";
import { CommandConstants } from "./constants";

const commands: vscode.Disposable[] = [];
const symbolDirectoryWatchers: Map<string, vscode.Disposable> = new Map<string, vscode.Disposable>();
const registeredSymbolModules: string[] = [];

let client: LC.LanguageClient;

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

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: "powerquery" },
            Subscriptions.createDocumentSemanticTokensProvider(client),
            Subscriptions.SemanticTokensLegend,
        ),
    );

    // Read initial configuration and configure listener. This needs to be done after the server is running.
    await processSymbolDirectories();

    return Object.freeze(symbolApi);
}

export function deactivate(): Thenable<void> | undefined {
    if (commands.length > 0) {
        commands.forEach((disposable: vscode.Disposable) => disposable.dispose());
        commands.length = 0;
    }

    disposeSymbolWatchers();

    return client?.stop();
}

async function processSymbolDirectories(): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("powerquery.client");
    const additionalSymbolsDirectories: string[] = config.get("additionalSymbolsDirectories") ?? [];

    // If we have previously registered symbols, clear them now.
    if (registeredSymbolModules.length > 0) {
        const existingModules: Map<string, null> = new Map();
        registeredSymbolModules.map((module: string) => existingModules.set(module, null));
        await symbolApi.setLibrarySymbols(existingModules);
    }

    const symbolFileActions: Thenable<[string, LibraryJson | undefined]>[] = [];

    additionalSymbolsDirectories.forEach(async (directory: string) => {
        const path: vscode.Uri = vscode.Uri.file(directory);
        const stat: vscode.FileStat = await vscode.workspace.fs.stat(path);

        // TODO: report that the path is invalid?
        if (stat.type !== vscode.FileType.Directory) {
            return;
        }

        const files: [string, vscode.FileType][] = await vscode.workspace.fs.readDirectory(path);

        files.forEach((file: [string, vscode.FileType]) => {
            const fileName: string = file[0];
            const fileType: vscode.FileType = file[1];

            if (fileType === vscode.FileType.File && fileName.toLocaleLowerCase().endsWith(".json")) {
                symbolFileActions.push(processSymbolFile(path, fileName));
            }
        });

        const allSymbolFiles: [string, LibraryJson | undefined][] = await Promise.all(symbolFileActions);
        const validSymbols: Map<string, LibraryJson> = new Map();

        allSymbolFiles.forEach((result: [string, LibraryJson | undefined]) => {
            if (result[1]) {
                validSymbols.set(result[0], result[1]);
            }
        });

        await symbolApi.setLibrarySymbols(validSymbols);

        // TODO: setup file watcher

        // const pattern = new vscode.RelativePattern(workspaceFolder, "Tests/**/*.query.pq");
        // const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    });
}

function disposeSymbolWatchers(): void {
    symbolDirectoryWatchers.forEach((item: vscode.Disposable, _: string) => item.dispose());
    symbolDirectoryWatchers.clear();
}

async function processSymbolFile(directory: vscode.Uri, file: string): Promise<[string, LibraryJson | undefined]> {
    const fileUri: vscode.Uri = vscode.Uri.joinPath(directory, file);

    const contents: Uint8Array = await vscode.workspace.fs.readFile(fileUri);
    const text: string = new TextDecoder("utf-8").decode(contents);

    try {
        const library: LibraryJson = JSON.parse(text);

        return [file, library];
    } catch (e) {
        // TODO: display the error?
    }

    return [file, undefined];
}

const symbolApi: PowerQueryApi = {
    // TODO: Deprecate
    onModuleLibraryUpdated: (workspaceUriPath: string, library: LibraryJson): void => {
        void client.sendRequest("powerquery/moduleLibraryUpdated", {
            workspaceUriPath,
            library,
        });
    },
    setLibrarySymbols: async (symbols: Map<string, LibraryJson | null>): Promise<void> => {
        await client.sendRequest("powerquery/setLibrarySymbols", {
            symbols,
        });
    },
};
