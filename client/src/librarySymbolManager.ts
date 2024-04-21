// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import { LibraryJson } from "./vscode-powerquery.api";
import { LibrarySymbolClient } from "./librarySymbolClient";

export type MinimalClientTrace = Pick<LC.BaseLanguageClient, "debug" | "info" | "warn" | "error">;

export class LibrarySymbolManager {
    private readonly registeredSymbolModules: string[] = [];

    constructor(private librarySymbolClient: LibrarySymbolClient, private clientTrace?: MinimalClientTrace) {}

    public async refreshSymbolDirectories(directories?: string[]): Promise<readonly string[]> {
        await this.clearAllRegisteredSymbolModules();

        if (!directories || directories.length === 0) {
            return [];
        }

        // Fetch the full list of files to process.
        const fileDiscovery: Promise<vscode.Uri[]>[] = [];
        const directoryUris: vscode.Uri[] = directories.map((d: string) => vscode.Uri.file(d));

        directoryUris.forEach((d: vscode.Uri) => {
            fileDiscovery.push(this.getSymbolFilesFromDirectory(d));
        });

        // TODO: check for duplicate module file names and only take the last one.
        // This would allow a connector developer to override a symbol library generated
        // with an older version of their connector.
        const symbolFileActions: Promise<[vscode.Uri, LibraryJson | undefined]>[] = [];
        const files: vscode.Uri[] = (await Promise.all(fileDiscovery)).flat();

        files.forEach((fileUri: vscode.Uri) => {
            symbolFileActions.push(this.processSymbolFile(fileUri));
        });

        // Process all symbol files, filtering out any that failed to load.
        const allSymbolFiles: [vscode.Uri, LibraryJson | undefined][] = await Promise.all(symbolFileActions);
        const validSymbolLibraries: [string, LibraryJson][] = [];

        allSymbolFiles.forEach((value: [vscode.Uri, LibraryJson | undefined]) => {
            if (value[1] !== undefined) {
                const fileName: string = LibrarySymbolManager.getModuleNameFromFileUri(value[0]);
                validSymbolLibraries.push([fileName, value[1] as LibraryJson]);
            }
        });

        this.clientTrace?.info(`Registering symbol files. Count: ${validSymbolLibraries.length}`);

        await this.librarySymbolClient
            .setLibrarySymbols(validSymbolLibraries)
            .then(() =>
                validSymbolLibraries.forEach((value: [string, LibraryJson]) =>
                    this.registeredSymbolModules.push(value[0]),
                ),
            );

        // TODO: setup file watcher
        // const pattern = new vscode.RelativePattern(workspaceFolder, "Tests/**/*.query.pq");
        // const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        return this.registeredSymbolModules;
    }

    public async getSymbolFilesFromDirectory(directory: vscode.Uri): Promise<vscode.Uri[]> {
        const stat: vscode.FileStat = await vscode.workspace.fs.stat(directory);

        if (stat.type !== vscode.FileType.Directory) {
            this.clientTrace?.warn(
                `Symbol path does not exist or is invalid '${directory.toString()}'. FileType: ${stat.type}`,
            );

            return [];
        }

        const files: [string, vscode.FileType][] = await vscode.workspace.fs.readDirectory(directory);

        // We only want .json files.
        return files
            .map((value: [string, vscode.FileType]): vscode.Uri | undefined => {
                const fileName: string = value[0];

                if (value[1] === vscode.FileType.File && fileName.toLocaleLowerCase().endsWith(".json")) {
                    return vscode.Uri.joinPath(directory, fileName);
                }

                return undefined;
            })
            .filter((value: vscode.Uri | undefined) => value !== undefined) as vscode.Uri[];
    }

    public async processSymbolFile(fileUri: vscode.Uri): Promise<[vscode.Uri, LibraryJson | undefined]> {
        try {
            const contents: Uint8Array = await vscode.workspace.fs.readFile(fileUri);
            const text: string = new TextDecoder("utf-8").decode(contents);
            const library: LibraryJson = JSON.parse(text);

            this.clientTrace?.debug(`Loaded symbol file '${fileUri.toString()}'. Symbol count: ${library.length}`);

            return [fileUri, library];
        } catch (error) {
            this.clientTrace?.error(
                `Error processing ${fileUri.toString()} as symbol library. Error: ${JSON.stringify(error)}`,
            );
        }

        return [fileUri, undefined];
    }

    private static getModuleNameFromFileUri(fileUri: vscode.Uri): string {
        return path.basename(fileUri.fsPath, "json");
    }

    private async clearAllRegisteredSymbolModules(): Promise<void> {
        if (this.registeredSymbolModules.length == 0) {
            return;
        }

        await this.clearSymbolModules(this.registeredSymbolModules).then(
            () => (this.registeredSymbolModules.length = 0),
        );
    }

    private async clearOneSymbolModule(module: string): Promise<void> {
        await this.clearSymbolModules([...module]).then(() => {
            const index: number | undefined = this.registeredSymbolModules.indexOf(module);

            if (index) {
                this.registeredSymbolModules.splice(index, 1);
            }
        });
    }

    private clearSymbolModules(modules: string[]): Promise<void> {
        const modulesToClear: [string, null][] = modules.map((module: string) => [module, null]);

        return this.librarySymbolClient.setLibrarySymbols(modulesToClear);
    }
}
