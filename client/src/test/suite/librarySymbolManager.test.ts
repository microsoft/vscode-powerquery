// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import * as vscode from "vscode";
import assert from "assert";

import * as TestUtils from "./testUtils";

import { LibraryJson, PowerQueryApi } from "../../powerQueryApi";
import { LibrarySymbolManager } from "../../librarySymbolManager";

class MockLibararySymbolClient implements PowerQueryApi {
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

const mockClient: MockLibararySymbolClient = new MockLibararySymbolClient();
const librarySymbolManager: LibrarySymbolManager = new LibrarySymbolManager(mockClient);

suite("LibrarySymbolManager.processSymbolFile", () => {
    test("Valid", async () => {
        const fileUri: vscode.Uri = TestUtils.getDocUri("ExtensionTest.json");

        const res: [vscode.Uri, LibraryJson] | undefined = await librarySymbolManager.processSymbolFile(fileUri);

        assert(res !== undefined, "Expected result");

        assert.equal(res[0], fileUri, "uri should match");
        assert.ok(res[1], "library should be defined");
        assert.equal(res[1].length, 1, "Expected one symbol");
        assert.equal(res[1][0].name, "ExtensionTest.Contents");
    });

    test("Not a symbol file", async () => {
        const fileUri: vscode.Uri = TestUtils.getDocUri("dataflow.json");

        const res: [vscode.Uri, LibraryJson] | undefined = await librarySymbolManager.processSymbolFile(fileUri);
        assert(res === undefined, "Expected library to be undefined");
    });

    test("Not json", async () => {
        const fileUri: vscode.Uri = TestUtils.getDocUri("index.js");

        const res: [vscode.Uri, LibraryJson] | undefined = await librarySymbolManager.processSymbolFile(fileUri);
        assert(res === undefined, "Expected library to be undefined");
    });

    test("Not a file", async () => {
        const fileUri: vscode.Uri = vscode.Uri.file(TestUtils.getTestFixturePath());

        const res: [vscode.Uri, LibraryJson] | undefined = await librarySymbolManager.processSymbolFile(fileUri);
        assert(res === undefined, "Expected library to be undefined");
    });
});

suite("LibrarySymbolManager.refreshSymbolDirectories", () => {
    test("Refresh with valid file", async () => {
        const modules: ReadonlyArray<string> = await librarySymbolManager.refreshSymbolDirectories([
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(modules.length, 1, "Expected one result");
        assert.ok(modules[0].includes("ExtensionTest"), "Expected module name to contain ExtensionTest");

        assert.ok(mockClient.registeredSymbols, "call should have been made");
        assert.equal(mockClient.registeredSymbols.size, 1, "Expected one element in the symbols call");

        // Find the entry by checking keys that end with ExtensionTest
        const matchingKey: string | undefined = Array.from(mockClient.registeredSymbols.keys()).find((key: string) =>
            key.includes("ExtensionTest"),
        );

        assert(matchingKey !== undefined, "Expected ExtensionTest to be in the results");
        const entry: LibraryJson | undefined = mockClient.registeredSymbols.get(matchingKey);
        assert(entry !== undefined, "Expected entry to exist");
        assert.equal(entry.length, 1, "Expected one library in the result");
        assert.equal(entry[0].name, "ExtensionTest.Contents");

        const resetModules: ReadonlyArray<string> = await librarySymbolManager.refreshSymbolDirectories([]);
        assert.equal(resetModules.length, 0, "Expected empty string array");
        assert.equal(mockClient.registeredSymbols.size, 0, "Expected registered symbols to be cleared");
    });
});

suite("LibrarySymbolManager.refreshSymbolDirectoriesForFolder", () => {
    teardown(async () => {
        await librarySymbolManager.removeAllSymbols();
        mockClient.reset();
    });

    test("Symbols are namespaced by folder key", async () => {
        const modules: ReadonlyArray<string> = await librarySymbolManager.refreshSymbolDirectoriesForFolder(
            "file:///folderA",
            [TestUtils.getTestFixturePath()],
        );

        assert.equal(modules.length, 1, "Expected one module");
        assert.ok(modules[0].startsWith("file:///folderA::"), "Expected module name to be namespaced with folder key");
        assert.ok(modules[0].endsWith("ExtensionTest"), "Expected module name to contain ExtensionTest");
    });

    test("Different folders can register same-named modules independently", async () => {
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", [
            TestUtils.getTestFixturePath(),
        ]);

        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderB", [
            TestUtils.getTestFixturePath(),
        ]);

        // Both folders should have their own namespaced copy
        assert.equal(mockClient.registeredSymbols.size, 2, "Expected two registered symbol sets");

        const keys: string[] = Array.from(mockClient.registeredSymbols.keys());
        const folderAKey: string | undefined = keys.find((k: string) => k.startsWith("file:///folderA::"));
        const folderBKey: string | undefined = keys.find((k: string) => k.startsWith("file:///folderB::"));

        assert.ok(folderAKey, "Expected folderA module");
        assert.ok(folderBKey, "Expected folderB module");
        assert.notEqual(folderAKey, folderBKey, "Keys should be different");
    });

    test("Refreshing one folder does not affect another folder's symbols", async () => {
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", [
            TestUtils.getTestFixturePath(),
        ]);

        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderB", [
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(mockClient.registeredSymbols.size, 2, "Expected two registered symbol sets");

        // Clear folderA's symbols by refreshing with empty directories
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", []);

        // FolderB's symbols should still be registered
        assert.equal(mockClient.registeredSymbols.size, 1, "Expected one registered symbol set remaining");

        const remainingKey: string = Array.from(mockClient.registeredSymbols.keys())[0];
        assert.ok(remainingKey.startsWith("file:///folderB::"), "Expected folderB's symbols to remain");
    });

    test("removeSymbolsForFolder removes only that folder's symbols", async () => {
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", [
            TestUtils.getTestFixturePath(),
        ]);

        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderB", [
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(mockClient.registeredSymbols.size, 2);

        await librarySymbolManager.removeSymbolsForFolder("file:///folderA");

        assert.equal(mockClient.registeredSymbols.size, 1, "Expected one registered symbol set remaining");
        const remainingKey: string = Array.from(mockClient.registeredSymbols.keys())[0];
        assert.ok(remainingKey.startsWith("file:///folderB::"), "Expected folderB's symbols to remain");
    });

    test("removeAllSymbols clears all folders", async () => {
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", [
            TestUtils.getTestFixturePath(),
        ]);

        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderB", [
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(mockClient.registeredSymbols.size, 2);

        await librarySymbolManager.removeAllSymbols();

        assert.equal(mockClient.registeredSymbols.size, 0, "Expected all symbols to be cleared");
    });

    test("Refreshing a folder replaces its previous symbols", async () => {
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", [
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(mockClient.registeredSymbols.size, 1);

        // Refresh folderA again with same directories — should clear old and re-register
        await librarySymbolManager.refreshSymbolDirectoriesForFolder("file:///folderA", [
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(mockClient.registeredSymbols.size, 1, "Expected exactly one symbol set after re-refresh");
        const key: string = Array.from(mockClient.registeredSymbols.keys())[0];
        assert.ok(key.startsWith("file:///folderA::"), "Expected folderA namespace");
    });
});

suite("LibrarySymbolManager.getSymbolFilesFromDirectory", () => {
    test("Two files", async () => await runDirectoryTest(TestUtils.getTestFixturePath(), 2));
    test("Does not exist", async () => await runDirectoryTest(TestUtils.randomDirName(), 0));
    test("Invalid dir name: symbols", async () => await runDirectoryTest("@@$$%!!~~!!!", 0));

    test("No files", async () => {
        const tmpDir: string = fs.mkdtempSync(TestUtils.randomDirName());

        try {
            const dirUri: vscode.Uri = vscode.Uri.file(tmpDir);
            const res: ReadonlyArray<vscode.Uri> = await librarySymbolManager.getSymbolFilesFromDirectory(dirUri);
            assert.equal(res.length, 0);
        } finally {
            try {
                if (tmpDir) {
                    fs.rmSync(tmpDir, { recursive: true });
                }
            } catch (e) {
                console.error(`An error has occurred while removing the temp folder ${tmpDir}. Error: ${e}`);
            }
        }
    });
});

async function runDirectoryTest(path: string, count: number): Promise<void> {
    const dirUri: vscode.Uri = vscode.Uri.file(path);
    const result: ReadonlyArray<vscode.Uri> = await librarySymbolManager.getSymbolFilesFromDirectory(dirUri);
    assert.equal(result.length, count, "Expected file count did not match");
}
