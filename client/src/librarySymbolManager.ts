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

    private readonly fs: vscode.FileSystem;
    private readonly registeredSymbolModules: string[] = [];

    constructor(
        private librarySymbolClient: PowerQueryApi,
        private clientTrace?: MinimalClientTrace,
        fs?: vscode.FileSystem,
    ) {
        this.fs = fs ?? vscode.workspace.fs;
    }

    public async refreshSymbolDirectories(directories: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        await this.clearAllRegisteredSymbolModules();

        if (!directories || directories.length === 0) {
            return [];
        }

        // Fetch the full list of files to process.
        const fileDiscoveryActions: Promise<ReadonlyArray<vscode.Uri>>[] = [];

        const normalizedDirectoryUris: ReadonlyArray<vscode.Uri> = directories.map((directory: string) => {
            const normalized: string = path.normalize(directory);

            if (directory !== normalized) {
                this.clientTrace?.info(`Normalized symbol file path '${directory}' => '${normalized}'`);
            }

            return vscode.Uri.file(normalized);
        });

        const dedupedDirectoryUris: ReadonlyArray<vscode.Uri> = Array.from(new Set(normalizedDirectoryUris));

        for (const uri of dedupedDirectoryUris) {
            fileDiscoveryActions.push(this.getSymbolFilesFromDirectory(uri));
        }

        // TODO: check for duplicate module file names and only take the last one.
        // This would allow a connector developer to override a symbol library generated
        // with an older version of their connector.
        const symbolFileActions: Promise<[vscode.Uri, LibraryJson] | undefined>[] = [];
        const files: ReadonlyArray<vscode.Uri> = (await Promise.all(fileDiscoveryActions)).flat();

        for (const fileUri of files) {
            symbolFileActions.push(this.processSymbolFile(fileUri));
        }

        if (symbolFileActions.length === 0) {
            this.clientTrace?.info(
                `No symbol files (${LibrarySymbolManager.SymbolFileExtension}) found in symbol file directories.`,
            );

            return [];
        }

        // Process all symbol files, filtering out any that failed to load.
        const allSymbolFiles: ReadonlyArray<[vscode.Uri, LibraryJson]> = (await Promise.all(symbolFileActions)).filter(
            (value: [vscode.Uri, LibraryJson] | undefined) => value !== undefined,
        ) as ReadonlyArray<[vscode.Uri, LibraryJson]>;

        const validSymbolLibraries: Map<string, LibraryJson> = new Map<string, LibraryJson>();

        for (const [uri, library] of allSymbolFiles) {
            const moduleName: string = LibrarySymbolManager.getModuleNameFromFileUri(uri);
            validSymbolLibraries.set(moduleName, library);
        }

        this.clientTrace?.info(`Registering symbol files. Total file count: ${validSymbolLibraries.size}`);

        if (validSymbolLibraries.size > 0) {
            await this.librarySymbolClient
                .addLibrarySymbols(validSymbolLibraries)
                .then(() => this.registeredSymbolModules.push(...validSymbolLibraries.keys()));
        }

        return this.registeredSymbolModules;
    }

    public async getSymbolFilesFromDirectory(directory: vscode.Uri): Promise<ReadonlyArray<vscode.Uri>> {
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
        } catch (error: unknown) {
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

    public async processSymbolFile(fileUri: vscode.Uri): Promise<[vscode.Uri, LibraryJson] | undefined> {
        try {
            const contents: Uint8Array = await this.fs.readFile(fileUri);
            const text: string = new TextDecoder(LibrarySymbolManager.SymbolFileEncoding).decode(contents);

            const library: LibraryJson = LibrarySymbolUtils.parseLibraryJson(text);

            this.clientTrace?.debug(`Loaded symbol file '${fileUri.toString()}'. Symbol count: ${library.length}`);

            return [fileUri, library];
        } catch (error: unknown) {
            this.clientTrace?.error(
                `${
                    LibrarySymbolManager.ErrorMessagePrefix
                } Error processing '${fileUri.toString()}' as symbol library.`,
                error,
            );
        }

        return undefined;
    }

    private static getModuleNameFromFileUri(fileUri: vscode.Uri): string {
        return path.basename(fileUri.fsPath, LibrarySymbolManager.SymbolFileExtension);
    }

    private async clearAllRegisteredSymbolModules(): Promise<void> {
        if (this.registeredSymbolModules.length === 0) {
            return;
        }

        await this.librarySymbolClient
            .removeLibrarySymbols(this.registeredSymbolModules)
            .then(() => (this.registeredSymbolModules.length = 0));
    }
}
