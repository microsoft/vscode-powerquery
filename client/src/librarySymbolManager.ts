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

    // The key used for symbols not associated with a specific workspace folder (e.g. single-folder workspaces).
    private static readonly GlobalFolderKey: string = "__global__";

    private readonly fs: vscode.FileSystem;

    // Tracks registered module names per workspace folder key.
    private readonly registeredModulesByFolder: Map<string, string[]> = new Map();

    constructor(
        private librarySymbolClient: PowerQueryApi,
        private clientTrace?: MinimalClientTrace,
        fs?: vscode.FileSystem,
    ) {
        this.fs = fs ?? vscode.workspace.fs;
    }

    /**
     * Refreshes symbol directories for a specific workspace folder.
     * Only clears and reloads symbols associated with the given folder key.
     */
    public async refreshSymbolDirectoriesForFolder(
        folderKey: string,
        directories: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<string>> {
        await this.clearRegisteredSymbolModulesForFolder(folderKey);

        if (!directories || directories.length === 0) {
            return [];
        }

        const validSymbolLibraries: Map<string, LibraryJson> = await this.loadSymbolsFromDirectories(directories);

        // Prefix module names with the folder key to avoid cross-folder collisions.
        const namespacedLibraries: Map<string, LibraryJson> = new Map();

        for (const [moduleName, library] of validSymbolLibraries) {
            const namespacedName: string = LibrarySymbolManager.namespacedModuleName(folderKey, moduleName);
            namespacedLibraries.set(namespacedName, library);
        }

        this.clientTrace?.info(
            `Registering symbol files for folder '${folderKey}'. Total file count: ${namespacedLibraries.size}`,
        );

        if (namespacedLibraries.size > 0) {
            await this.librarySymbolClient.addLibrarySymbols(namespacedLibraries);
            const folderModules: string[] = this.registeredModulesByFolder.get(folderKey) ?? [];
            folderModules.push(...namespacedLibraries.keys());
            this.registeredModulesByFolder.set(folderKey, folderModules);
        }

        return this.registeredModulesByFolder.get(folderKey) ?? [];
    }

    /**
     * Refreshes symbol directories without folder scoping (single-folder or no-folder workspaces).
     */
    public async refreshSymbolDirectories(directories: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        return await this.refreshSymbolDirectoriesForFolder(LibrarySymbolManager.GlobalFolderKey, directories);
    }

    /**
     * Removes all registered symbol modules for a specific workspace folder.
     */
    public async removeSymbolsForFolder(folderKey: string): Promise<void> {
        await this.clearRegisteredSymbolModulesForFolder(folderKey);
    }

    /**
     * Removes all registered symbol modules across all folders.
     */
    public async removeAllSymbols(): Promise<void> {
        const allModules: string[] = Array.from(this.registeredModulesByFolder.values()).flat();

        if (allModules.length === 0) {
            return;
        }

        await this.librarySymbolClient.removeLibrarySymbols(allModules);
        this.registeredModulesByFolder.clear();
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

    private static namespacedModuleName(folderKey: string, moduleName: string): string {
        return `${folderKey}::${moduleName}`;
    }

    private static getModuleNameFromFileUri(fileUri: vscode.Uri): string {
        return path.basename(fileUri.fsPath, LibrarySymbolManager.SymbolFileExtension);
    }

    private async loadSymbolsFromDirectories(directories: ReadonlyArray<string>): Promise<Map<string, LibraryJson>> {
        const fileDiscoveryActions: Promise<ReadonlyArray<vscode.Uri>>[] = [];

        const normalizedPaths: string[] = directories.map((directory: string) => {
            const normalized: string = path.normalize(directory);

            if (directory !== normalized) {
                this.clientTrace?.info(`Normalized symbol file path '${directory}' => '${normalized}'`);
            }

            return normalized;
        });

        const dedupedDirectoryUris: ReadonlyArray<vscode.Uri> = Array.from(new Set(normalizedPaths)).map(
            (p: string) => vscode.Uri.file(p),
        );

        for (const uri of dedupedDirectoryUris) {
            fileDiscoveryActions.push(this.getSymbolFilesFromDirectory(uri));
        }

        const symbolFileActions: Promise<[vscode.Uri, LibraryJson] | undefined>[] = [];
        const files: ReadonlyArray<vscode.Uri> = (await Promise.all(fileDiscoveryActions)).flat();

        for (const fileUri of files) {
            symbolFileActions.push(this.processSymbolFile(fileUri));
        }

        if (symbolFileActions.length === 0) {
            this.clientTrace?.info(
                `No symbol files (${LibrarySymbolManager.SymbolFileExtension}) found in symbol file directories.`,
            );

            return new Map();
        }

        const allSymbolFiles: ReadonlyArray<[vscode.Uri, LibraryJson]> = (await Promise.all(symbolFileActions)).filter(
            (value: [vscode.Uri, LibraryJson] | undefined) => value !== undefined,
        ) as ReadonlyArray<[vscode.Uri, LibraryJson]>;

        const validSymbolLibraries: Map<string, LibraryJson> = new Map<string, LibraryJson>();

        for (const [uri, library] of allSymbolFiles) {
            const moduleName: string = LibrarySymbolManager.getModuleNameFromFileUri(uri);
            validSymbolLibraries.set(moduleName, library);
        }

        return validSymbolLibraries;
    }

    private async clearRegisteredSymbolModulesForFolder(folderKey: string): Promise<void> {
        const folderModules: string[] | undefined = this.registeredModulesByFolder.get(folderKey);

        if (!folderModules || folderModules.length === 0) {
            return;
        }

        await this.librarySymbolClient.removeLibrarySymbols(folderModules);
        this.registeredModulesByFolder.delete(folderKey);
    }
}
