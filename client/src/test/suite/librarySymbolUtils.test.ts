// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";

import * as LibrarySymbolUtils from "../../librarySymbolUtils";
import * as TestUtils from "./testUtils";
import { LibraryJson } from "../../vscode-powerquery.api";

suite("LibrarySymbolUtils", () => {
    suite("parseLibraryJson", () => {
        test("Valid from file", () => {
            const fileUri: vscode.Uri = TestUtils.getDocUri("ExtensionTest.json");
            const contents: string = fs.readFileSync(fileUri.fsPath, "utf-8");
            const library: LibraryJson = LibrarySymbolUtils.parseLibraryJson(contents);

            assert.equal(library.length, 1);
            assert.equal(library[0].name, "ExtensionTest.Contents");
        });
    });
});
