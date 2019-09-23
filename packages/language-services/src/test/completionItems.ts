// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import * as Utils from "./utils";

const totalKeywordCount: number = 24;

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
    it("blank document keywords", async () => {
        const result: CompletionItem[] = await await Utils.getCompletionItems("|", Utils.errorAnalysisOptions);

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItem(result, "let");
        Utils.containsCompletionItem(result, "shared");
        Utils.containsCompletionItem(result, "#shared");
    });
});
