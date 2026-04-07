// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";

import { LibraryJson, PowerQueryApi } from "../../powerQueryApi";
import { LibrarySymbolManager } from "../../librarySymbolManager";

class MockLibrarySymbolClient implements PowerQueryApi {
    public registeredSymbols: Map<string, LibraryJson> = new Map();

    onModuleLibraryUpdated(_workspaceUriPath: string, _library: LibraryJson): void {
        throw new Error("Function not implemented.");
    }

    addLibrarySymbols(librarySymbols: ReadonlyMap<string, LibraryJson>): Promise<void> {
        for (const [key, value] of librarySymbols) {
            this.registeredSymbols.set(key, value);
        }

        return Promise.resolve();
    }

    removeLibrarySymbols(librariesToRemove: ReadonlyArray<string>): Promise<void> {
        for (const library of librariesToRemove) {
            this.registeredSymbols.delete(library);
        }

        return Promise.resolve();
    }

    reset(): void {
        this.registeredSymbols.clear();
    }
}

const multiRootFixturePath: string = path.resolve(__dirname, "../../../src/test/multiRootFixture");

function getSymbolsDirForFolder(folderName: string): string {
    return path.resolve(multiRootFixturePath, folderName, "symbols");
}

suite("Multi-root Workspace Tests", () => {
    test("workspace has multiple folders", () => {
        const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        assert.ok(folders, "Expected workspace folders to be defined");
        assert.equal(folders.length, 2, "Expected two workspace folders");

        const folderNames: string[] = folders.map((f: vscode.WorkspaceFolder) => f.name);
        assert.ok(folderNames.includes("workspaceA"), "Expected workspaceA folder");
        assert.ok(folderNames.includes("workspaceB"), "Expected workspaceB folder");
    });

    test("extension activates in multi-root workspace", async () => {
        const ext: vscode.Extension<PowerQueryApi> | undefined =
            vscode.extensions.getExtension("powerquery.vscode-powerquery");

        assert.ok(ext, "Extension should be available");

        const api: PowerQueryApi = await ext.activate();
        assert.ok(api, "Extension should return an API");
        assert.ok(api.addLibrarySymbols, "API should have addLibrarySymbols");
        assert.ok(api.removeLibrarySymbols, "API should have removeLibrarySymbols");
    });
});

suite("Multi-root Workspace - Per-folder symbol isolation", () => {
    const mockClient: MockLibrarySymbolClient = new MockLibrarySymbolClient();
    const manager: LibrarySymbolManager = new LibrarySymbolManager(mockClient);

    teardown(async () => {
        await manager.removeAllSymbols();
        mockClient.reset();
    });

    test("each folder loads its own symbols independently", async () => {
        const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length >= 2, "Need at least two workspace folders");

        // Register symbols for each folder using its own symbol directory
        await Promise.all(
            folders.map((folder: vscode.WorkspaceFolder) => {
                const symbolsDir: string = getSymbolsDirForFolder(folder.name);

                return manager.refreshSymbolDirectoriesForFolder(folder.uri.toString(), [symbolsDir]);
            }),
        );

        // Both folders should have symbols registered
        assert.equal(mockClient.registeredSymbols.size, 2, "Expected two symbol sets");

        // Verify ConnectorA is namespaced under workspaceA
        const keys: string[] = Array.from(mockClient.registeredSymbols.keys());
        const folderAKeys: string[] = keys.filter((k: string) => k.includes("workspaceA"));
        const folderBKeys: string[] = keys.filter((k: string) => k.includes("workspaceB"));

        assert.equal(folderAKeys.length, 1, "Expected one symbol set for workspaceA");
        assert.equal(folderBKeys.length, 1, "Expected one symbol set for workspaceB");

        // Verify the actual symbol content is correct
        const connectorASymbols: LibraryJson | undefined = mockClient.registeredSymbols.get(folderAKeys[0]);
        assert.ok(connectorASymbols, "ConnectorA symbols should exist");
        assert.equal(connectorASymbols[0].name, "ConnectorA.Contents");

        const connectorBSymbols: LibraryJson | undefined = mockClient.registeredSymbols.get(folderBKeys[0]);
        assert.ok(connectorBSymbols, "ConnectorB symbols should exist");
        assert.equal(connectorBSymbols[0].name, "ConnectorB.Contents");
    });

    test("removing a workspace folder clears only its symbols", async () => {
        const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length >= 2);

        await Promise.all(
            folders.map((folder: vscode.WorkspaceFolder) => {
                const symbolsDir: string = getSymbolsDirForFolder(folder.name);

                return manager.refreshSymbolDirectoriesForFolder(folder.uri.toString(), [symbolsDir]);
            }),
        );

        assert.equal(mockClient.registeredSymbols.size, 2);

        // Simulate removing workspaceA
        await manager.removeSymbolsForFolder(folders[0].uri.toString());

        assert.equal(mockClient.registeredSymbols.size, 1, "Expected one symbol set remaining");

        // The remaining symbols should be from the second folder
        const remainingKey: string = Array.from(mockClient.registeredSymbols.keys())[0];

        assert.ok(
            remainingKey.includes(folders[1].name),
            `Expected remaining symbols from ${folders[1].name}, got key: ${remainingKey}`,
        );
    });

    test("refreshing one folder preserves other folder symbols", async () => {
        const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length >= 2);

        // Register symbols for both folders
        await Promise.all(
            folders.map((folder: vscode.WorkspaceFolder) => {
                const symbolsDir: string = getSymbolsDirForFolder(folder.name);

                return manager.refreshSymbolDirectoriesForFolder(folder.uri.toString(), [symbolsDir]);
            }),
        );

        assert.equal(mockClient.registeredSymbols.size, 2);

        // Re-register symbols for folderA only
        const symbolsDirA: string = getSymbolsDirForFolder(folders[0].name);
        await manager.refreshSymbolDirectoriesForFolder(folders[0].uri.toString(), [symbolsDirA]);

        // Both folders should still have symbols
        assert.equal(mockClient.registeredSymbols.size, 2, "Expected both folders to still have symbols");
    });

    test("per-folder config can be read with scope URI", () => {
        const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length >= 2);

        // Verify we can read config scoped to each workspace folder
        for (const folder of folders) {
            const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
                "powerquery.client",
                folder.uri,
            );

            // The setting should be readable (even if undefined/default)
            const dirs: string[] | undefined = config.get("additionalSymbolsDirectories");
            assert.ok(dirs === undefined || Array.isArray(dirs), "Setting should be undefined or an array");
        }
    });
});
