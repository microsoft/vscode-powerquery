// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import * as Utils from "./utils";

const totalKeywordCount: number = 24;
const libraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider(["Text.NewGuid"]);

describe("Completion Items (null provider)", () => {
    // TODO: add more keyword tests
    it("blank document keywords", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|");

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItem(result, "let");
        Utils.containsCompletionItem(result, "shared");
        Utils.containsCompletionItem(result, "#shared");
    });

    it("simple document keywords", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("let\na = 12,\nb=4, c = 2\nin\n  |");
        expect(result.length).to.equal(totalKeywordCount);
    });
});

describe("Completion Items (error provider)", () => {
    it("keywords still work", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", Utils.errorAnalysisOptions);

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItem(result, "let");
        Utils.containsCompletionItem(result, "shared");
        Utils.containsCompletionItem(result, "#shared");
    });
});

describe("Completion Items (Simple provider)", () => {
    it("keywords still work", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            librarySymbolProvider: libraryProvider,
        });

        Utils.containsCompletionItem(result, "Text.NewGuid");

        Utils.containsCompletionItem(result, "let");
        Utils.containsCompletionItem(result, "#shared");
        Utils.containsCompletionItem(result, "#shared");
    });
});
