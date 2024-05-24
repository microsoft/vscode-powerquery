// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

import { LibraryJson, PowerQueryApi } from "../../powerQueryApi";
import { LibrarySymbolManager } from "../../librarySymbolManager";

class MockLibararySymbolClient implements PowerQueryApi {
    public lastLibrarySymbols: [string, LibraryJson | null][] | undefined;

    onModuleLibraryUpdated(_workspaceUriPath: string, _library: LibraryJson): void {
        throw new Error("Function not implemented.");
    }

    setLibrarySymbols(
        librarySymbols: [string, LibraryJson | null][],
        _token?: vscode.CancellationToken,
    ): Promise<void> {
        this.lastLibrarySymbols = librarySymbols;

        return Promise.resolve();
    }

    reset(): void {
        this.lastLibrarySymbols = undefined;
    }
}

const mockClient: MockLibararySymbolClient = new MockLibararySymbolClient();
const librarySymbolManager: LibrarySymbolManager = new LibrarySymbolManager(mockClient);

suite("LibrarySymbolManager.processSymbolFile", () => {
    test("Valid", async () => {
        const fileUri: vscode.Uri = TestUtils.getDocUri("ExtensionTest.json");

        const res: [vscode.Uri, LibraryJson | undefined] = await librarySymbolManager.processSymbolFile(fileUri);

        assert.equal(res[0], fileUri, "uri should match");
        assert.ok(res[1], "library should be defined");
        assert.equal(res[1].length, 1, "Expected one symbol");
        assert.equal(res[1][0].name, "ExtensionTest.Contents");
    });

    test("Not a symbol file", async () => {
        const fileUri: vscode.Uri = TestUtils.getDocUri("dataflow.json");

        const res: [vscode.Uri, LibraryJson | undefined] = await librarySymbolManager.processSymbolFile(fileUri);

        assert.equal(res[0], fileUri, "uri should match");
        assert.equal(res[1] === undefined, true, "library expected to be undefined");
    });

    test("Not json", async () => {
        const fileUri: vscode.Uri = TestUtils.getDocUri("index.js");

        const res: [vscode.Uri, LibraryJson | undefined] = await librarySymbolManager.processSymbolFile(fileUri);

        assert.equal(res[0], fileUri, "uri should match");
        assert.equal(res[1] === undefined, true, "library expected to be undefined");
    });

    test("Not a file", async () => {
        const fileUri: vscode.Uri = vscode.Uri.file(TestUtils.getTestFixturePath());

        const res: [vscode.Uri, LibraryJson | undefined] = await librarySymbolManager.processSymbolFile(fileUri);

        assert.equal(res[0], fileUri, "uri should match");
        assert.equal(res[1] === undefined, true, "library expected to be undefined");
    });
});

suite("LibrarySymbolManager.refreshSymbolDirectories", () => {
    test("Refresh with valid file", async () => {
        const modules: readonly string[] = await librarySymbolManager.refreshSymbolDirectories([
            TestUtils.getTestFixturePath(),
        ]);

        assert.equal(modules.length, 1, "Expected one result");
        assert.equal(modules[0], "ExtensionTest");

        assert.ok(mockClient.lastLibrarySymbols, "call should have been made");
        assert.equal(mockClient.lastLibrarySymbols.length, 1, "Expected one element in the symbols call");

        const entry: [string, LibraryJson | null] = mockClient.lastLibrarySymbols[0];
        assert.equal(entry[0], "ExtensionTest", "Unexpected module name");
        assert.ok(entry[1], "Expected libraries");
        assert.equal(entry[1].length, 1, "Expected one library in the result");
        assert.equal(entry[1][0].name, "ExtensionTest.Contents");

        const resetModules: readonly string[] = await librarySymbolManager.refreshSymbolDirectories(undefined);
        assert.equal(resetModules.length, 0, "Expected empty string array");

        assert.ok(mockClient.lastLibrarySymbols, "call should have been made to clear results");
        assert.equal(mockClient.lastLibrarySymbols.length, 1, "Expected one element in cleared results");

        const clearedEntry: [string, LibraryJson | null] = mockClient.lastLibrarySymbols[0];
        assert.equal(clearedEntry[0], "ExtensionTest", "Unexpected module name in cleared results");
        assert.equal(clearedEntry[1], null, "Expected library value to be null");
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
            const res: vscode.Uri[] = await librarySymbolManager.getSymbolFilesFromDirectory(dirUri);
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
    const res: vscode.Uri[] = await librarySymbolManager.getSymbolFilesFromDirectory(dirUri);
    assert.equal(res.length, count, "Expected file count did not match");
}
