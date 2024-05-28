// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as fs from "fs";
import * as vscode from "vscode";
import { expect } from "chai";

import * as LibrarySymbolUtils from "../../librarySymbolUtils";
import * as TestUtils from "./testUtils";
import { LibraryJson } from "../../powerQueryApi";

suite("LibrarySymbolUtils", () => {
    suite("parseLibraryJson", () => {
        test("Empty", () => {
            expect(() => LibrarySymbolUtils.parseLibraryJson("")).to.throw();
        });

        test("Empty JSON object", () => {
            expect(() => LibrarySymbolUtils.parseLibraryJson("{}")).to.throw("Expected an array");
        });

        test("Empty root array", () => {
            const library: LibraryJson = LibrarySymbolUtils.parseLibraryJson("[]");
            assert.equal(library.length, 0);
        });

        test("Invalid symbol", () => {
            expect(() => LibrarySymbolUtils.parseLibraryJson(`[{"not": "a", "symbol": [] }]`)).to.throw(
                "Missing property: name",
            );
        });

        test("Valid from file", () => {
            const fileUri: vscode.Uri = TestUtils.getDocUri("ExtensionTest.json");
            const contents: string = fs.readFileSync(fileUri.fsPath, "utf-8");
            const library: LibraryJson = LibrarySymbolUtils.parseLibraryJson(contents);

            assert.equal(library.length, 1);
            assert.equal(library[0].name, "ExtensionTest.Contents");
        });
    });
});
