// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";
import { afterEach } from "mocha";

import * as TestUtils from "./testUtils";
import { LibraryJson, PowerQueryApi } from "../../vscode-powerquery.api";
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
    afterEach(() => mockClient.reset());

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
});
