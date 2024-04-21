// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";

import { LibraryJson } from "./vscode-powerquery.api";
import { LibrarySymbolClient } from "./librarySymbolClient";

// We want to group all symbol modules into a single request to avoid multiple rounds of processing.
export async function processSymbolDirectories(
    librarySymbolClient: LibrarySymbolClient,
    currentSymbolModules: string[] = [],
): Promise<string[]> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("powerquery.client");
    const additionalSymbolsDirectories: string[] = config.get("additionalSymbolsDirectories") ?? [];

    // If we have previously registered symbols, clear them now.
    if (currentSymbolModules.length > 0) {
        const existingModules: [string, null][] = currentSymbolModules.map((module: string) => [module, null]);
        await librarySymbolClient.setLibrarySymbols(existingModules);
    }

    // Fetch the full list of files to process.
    const fileDiscovery: Thenable<vscode.Uri[]>[] = [];

    additionalSymbolsDirectories.forEach((directory: string) => {
        fileDiscovery.push(processSymbolDirectory(directory));
    });

    // TODO: check for duplicate module file names and only take the last one.
    // This would allow a connector developer to override a symbol library generated
    // with an older version of their connector.
    const symbolFileActions: Thenable<[vscode.Uri, LibraryJson | undefined]>[] = [];
    const files: vscode.Uri[] = (await Promise.all(fileDiscovery)).flat();

    files.forEach((fileUri: vscode.Uri) => {
        symbolFileActions.push(processSymbolFile(fileUri));
    });

    // Process all symbol files, filtering out any that failed to load.
    const allSymbolFiles: [vscode.Uri, LibraryJson | undefined][] = await Promise.all(symbolFileActions);
    const validSymbolLibraries: [string, LibraryJson][] = [];

    allSymbolFiles.forEach((value: [vscode.Uri, LibraryJson | undefined]) => {
        if (value[1] !== undefined) {
            const fileName: string = path.basename(value[0].fsPath);
            validSymbolLibraries.push([fileName, value[1] as LibraryJson]);
        }
    });

    // Register the symbols and track the module file names locally so the
    // file system watcher handlers can do the right thing.
    const registeredSymbolModules: string[] = [];

    await librarySymbolClient
        .setLibrarySymbols(validSymbolLibraries)
        .then(() =>
            validSymbolLibraries.forEach((value: [string, LibraryJson]) => registeredSymbolModules.push(value[0])),
        );

    // TODO: setup file watcher
    // const pattern = new vscode.RelativePattern(workspaceFolder, "Tests/**/*.query.pq");
    // const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    return registeredSymbolModules;
}

export async function processSymbolDirectory(directory: string): Promise<vscode.Uri[]> {
    const path: vscode.Uri = vscode.Uri.file(directory);
    const stat: vscode.FileStat = await vscode.workspace.fs.stat(path);

    // TODO: report that the path is invalid?
    if (stat.type !== vscode.FileType.Directory) {
        return [];
    }

    const files: [string, vscode.FileType][] = await vscode.workspace.fs.readDirectory(path);

    // We only want .json files.
    return files
        .map((value: [string, vscode.FileType]): vscode.Uri | undefined => {
            const fileName: string = value[0];

            if (value[1] === vscode.FileType.File && fileName.toLocaleLowerCase().endsWith(".json")) {
                return vscode.Uri.joinPath(path, fileName);
            }

            return undefined;
        })
        .filter((value: vscode.Uri | undefined) => value !== undefined) as vscode.Uri[];
}

export async function processSymbolFile(fileUri: vscode.Uri): Promise<[vscode.Uri, LibraryJson | undefined]> {
    try {
        const contents: Uint8Array = await vscode.workspace.fs.readFile(fileUri);
        const text: string = new TextDecoder("utf-8").decode(contents);
        const library: LibraryJson = JSON.parse(text);

        return [fileUri, library];
    } catch (e) {
        // TODO: standardize error handling
        void (await vscode.window.showErrorMessage(
            `Error processing ${fileUri.toString()} as symbol library. Error: ${JSON.stringify(e)}`,
        ));
    }

    return [fileUri, undefined];
}
