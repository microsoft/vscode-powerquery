// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import * as LanguageServices from "../language-services";
import * as Utils from "./utils";

import { Analysis, AnalysisOptions } from "../language-services";

class ErrorProvider extends LanguageServices.NullLibrarySymbolProvider {
    public async getCompletionItems(context: LanguageServices.CompletionItemProviderContext): Promise<CompletionItem[]> {
        throw new Error("error provider always errors");
    }
}

const totalKeywordCount: number = 24;

const defaultAnalysisOptions: AnalysisOptions = {};
const errorAnalysisOptions: AnalysisOptions = {
    librarySymbolProvider: new ErrorProvider()
};

describe("Completion Items (null provider)", () => {
    // TODO: add more keyword tests
    it("blank document keywords", async () => {
        const document: Utils.MockDocument = Utils.createDocumentWithCursor("|");
        const analysis: Analysis = LanguageServices.createAnalysisSession(document, defaultAnalysisOptions);
        const result: CompletionItem[] = await analysis.getCompletionItems(document.cursorPosition);

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItem(result, "let");
        Utils.containsCompletionItem(result, "shared");
        Utils.containsCompletionItem(result, "#shared");
    });

    it("simple document keywords", async () => {
        const document: Utils.MockDocument = Utils.createDocumentWithCursor("let\na = 12,\nb=4, c = 2\nin\n  |");
        const analysis: Analysis = LanguageServices.createAnalysisSession(document, defaultAnalysisOptions);
        const result: CompletionItem[] = await analysis.getCompletionItems(document.cursorPosition);
        expect(result.length).to.equal(totalKeywordCount);
    });
});

describe("Completion Items (error provider)", () => {
    it("blank document keywords", async () => {
        const document: Utils.MockDocument = Utils.createDocumentWithCursor("|");
        const analysis: Analysis = LanguageServices.createAnalysisSession(document, errorAnalysisOptions);
        const result: CompletionItem[] = await analysis.getCompletionItems(document.cursorPosition);

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItem(result, "let");
        Utils.containsCompletionItem(result, "shared");
        Utils.containsCompletionItem(result, "#shared");
    });

});
