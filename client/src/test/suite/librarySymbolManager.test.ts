// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";

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
        assert.equal(modules[0], "ExtensionTest");

        assert.ok(mockClient.registeredSymbols, "call should have been made");
        assert.equal(mockClient.registeredSymbols.size, 1, "Expected one element in the symbols call");

        const entry: LibraryJson | undefined = mockClient.registeredSymbols.get("ExtensionTest");
        assert(entry !== undefined, "Expected ExtensionTest to in the results");
        assert.equal(entry.length, 1, "Expected one library in the result");
        assert.equal(entry[0].name, "ExtensionTest.Contents");

        const resetModules: ReadonlyArray<string> = await librarySymbolManager.refreshSymbolDirectories([]);
        assert.equal(resetModules.length, 0, "Expected empty string array");
        assert.equal(mockClient.registeredSymbols.size, 0, "Expected registered symbols to be cleared");
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
