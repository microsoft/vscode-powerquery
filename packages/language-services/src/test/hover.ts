// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { assert, expect } from "chai";

import * as Utils from "./utils";
import { Hover } from "vscode-languageserver-types";

const libraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider([
    "DateTime.FixedLocalNow",
    "DateTime.LocalNow",
    "Text.NewGuid",
]);

describe("Hover", () => {
    it("Not an identifier", async () => {
        const hover: Hover = await Utils.getHover('let a = "not iden|tifier" in a', {
            librarySymbolProvider: libraryProvider,
        });
        expect(hover).deep.equals(Utils.emptyHover);
    });

    it("Keyword hover", async () => {
        const hover: Hover = await Utils.getHover('le|t a = "not identifier" in a');
        expect(hover).deep.equals(Utils.emptyHover);
    });

    it("No provider", async () => {
        const hover: Hover = await Utils.getHover("let abc = Text.NewGu|id() in abc");
        expect(hover).deep.equals(Utils.emptyHover);
    });

    it("Simple provider", async () => {
        const hover: Hover = await Utils.getHover("let abc = Text.NewGu|id() in abc", {
            librarySymbolProvider: libraryProvider,
        });

        assert.isDefined(hover.range);
        assert.isDefined(hover.contents);
        expect(hover.contents.toString()).contains("Text.NewGuid");
    });

    it("Before .", async () => {
        const hover: Hover = await Utils.getHover("let abc = Text|.NewGuid() in abc", {
            librarySymbolProvider: libraryProvider,
        });

        assert.isDefined(hover.range);
        assert.isDefined(hover.contents);
        expect(hover.contents.toString()).contains("Text.NewGuid");
    });

    it("After .", async () => {
        const hover: Hover = await Utils.getHover("let abc = Text.|NewGuid() in abc", {
            librarySymbolProvider: libraryProvider,
        });

        assert.isDefined(hover.range);
        assert.isDefined(hover.contents);
        expect(hover.contents.toString()).contains("Text.NewGuid");
    });

    it("After identifier", async () => {
        const hover: Hover = await Utils.getHover("let\r\nabc = Text.NewGuid()| in abc", {
            librarySymbolProvider: libraryProvider,
        });

        expect(hover).deep.equals(Utils.emptyHover);
    });
});
