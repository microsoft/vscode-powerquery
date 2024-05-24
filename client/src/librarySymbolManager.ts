// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import * as LibrarySymbolUtils from "./librarySymbolUtils";

import { LibraryJson, PowerQueryApi } from "./powerQueryApi";

export type MinimalClientTrace = Pick<LC.BaseLanguageClient, "debug" | "info" | "warn" | "error">;
export type MinimalFileSystem = Pick<vscode.FileSystem, "readDirectory" | "readFile" | "stat">;

export class LibrarySymbolManager {
    private static readonly ErrorMessagePrefix: string =
        "Error processing symbol directory path. Please update your configuration.";
    private static readonly SymbolFileExtension: string = ".json";
    private static readonly SymbolFileEncoding: string = "utf-8";

    private readonly registeredSymbolModules: string[] = [];
    private readonly fs: vscode.FileSystem;

    constructor(
        private librarySymbolClient: PowerQueryApi,
        private clientTrace?: MinimalClientTrace,
        fs?: vscode.FileSystem,
    ) {
        this.fs = fs ?? vscode.workspace.fs;
    }

    public async refreshSymbolDirectories(directories?: string[]): Promise<readonly string[]> {
        await this.clearAllRegisteredSymbolModules();

        if (!directories || directories.length === 0) {
            return [];
        }

        const dedupedDirectories: string[] = Array.from(new Set(directories));

        // Fetch the full list of files to process.
        const fileDiscovery: Promise<vscode.Uri[]>[] = [];

        const directoryUris: vscode.Uri[] = dedupedDirectories.map((directory: string) => {
            const normalized: string = path.normalize(directory);

            if (directory !== normalized) {
                this.clientTrace?.info(`Normalized symbol file path '${directory}' => '${normalized}'`);
            }

            return vscode.Uri.file(normalized);
        });

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

        const validSymbolLibraries: Map<string, LibraryJson> = new Map<string, LibraryJson>();

        allSymbolFiles.forEach((value: [vscode.Uri, LibraryJson | undefined]) => {
            if (value[1] !== undefined) {
                const moduleName: string = LibrarySymbolManager.getModuleNameFromFileUri(value[0]);
                validSymbolLibraries.set(moduleName, value[1] as LibraryJson);
            }
        });

        this.clientTrace?.info(`Registering symbol files. Total file count: ${validSymbolLibraries.size}`);

        await this.librarySymbolClient
            .setLibrarySymbols(validSymbolLibraries)
            .then(() => this.registeredSymbolModules.push(...validSymbolLibraries.keys()));

        return this.registeredSymbolModules;
    }

    public async getSymbolFilesFromDirectory(directory: vscode.Uri): Promise<vscode.Uri[]> {
        let isDirectoryValid: boolean = false;

        try {
            const stat: vscode.FileStat = await this.fs.stat(directory);

            if (stat.type !== vscode.FileType.Directory) {
                this.clientTrace?.error(
                    `${LibrarySymbolManager.ErrorMessagePrefix} '${directory.toString()}' is not a directory.`,
                    JSON.stringify(stat),
                );
            } else {
                isDirectoryValid = true;
            }
        } catch (error) {
            this.clientTrace?.error(
                `${LibrarySymbolManager.ErrorMessagePrefix} Exception while processing '${directory.toString()}'.`,
                error,
            );
        }

        if (!isDirectoryValid) {
            return [];
        }

        const files: [string, vscode.FileType][] = await this.fs.readDirectory(directory);

        // We only want .json files.
        return files
            .map((value: [string, vscode.FileType]): vscode.Uri | undefined => {
                const fileName: string = value[0];

                if (
                    value[1] === vscode.FileType.File &&
                    fileName.toLocaleLowerCase().endsWith(LibrarySymbolManager.SymbolFileExtension)
                ) {
                    return vscode.Uri.joinPath(directory, fileName);
                }

                return undefined;
            })
            .filter((value: vscode.Uri | undefined) => value !== undefined) as vscode.Uri[];
    }

    public async processSymbolFile(fileUri: vscode.Uri): Promise<[vscode.Uri, LibraryJson | undefined]> {
        try {
            const contents: Uint8Array = await this.fs.readFile(fileUri);
            const text: string = new TextDecoder(LibrarySymbolManager.SymbolFileEncoding).decode(contents);

            const library: LibraryJson = LibrarySymbolUtils.parseLibraryJson(text);

            this.clientTrace?.debug(`Loaded symbol file '${fileUri.toString()}'. Symbol count: ${library.length}`);

            return [fileUri, library];
        } catch (error) {
            this.clientTrace?.error(
                `${
                    LibrarySymbolManager.ErrorMessagePrefix
                } Error processing '${fileUri.toString()}' as symbol library.`,
                error,
            );
        }

        return [fileUri, undefined];
    }

    private static getModuleNameFromFileUri(fileUri: vscode.Uri): string {
        return path.basename(fileUri.fsPath, LibrarySymbolManager.SymbolFileExtension);
    }

    private async clearAllRegisteredSymbolModules(): Promise<void> {
        if (this.registeredSymbolModules.length == 0) {
            return;
        }

        await this.clearSymbolModules(this.registeredSymbolModules).then(
            () => (this.registeredSymbolModules.length = 0),
        );
    }

    private clearSymbolModules(modules: string[]): Promise<void> {
        const modulesToClear: Map<string, null> = new Map(modules.map((m: string) => [m, null]));

        return this.librarySymbolClient.setLibrarySymbols(modulesToClear);
    }
}
