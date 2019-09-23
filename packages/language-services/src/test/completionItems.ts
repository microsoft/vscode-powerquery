// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import * as LanguageServices from "../language-services";
import * as Utils from "./utils";

// class ErrorProvider extends LanguageServices.NullLibrarySymbolProvider {
//     public async getCompletionItems(context: LanguageServices.CompletionItemProviderContext): Promise<CompletionItem[]> {
//         throw new Error("error provider always errors");
//     }
// }

const totalKeywordCount: number = 24;

describe("Completion Items (null provider)", () => {
    LanguageServices.registerLibrarySymbolProvider(new LanguageServices.NullLibrarySymbolProvider());

    // TODO: add more keyword tests
    it("blank document keywords", async () => {
        const document: Utils.MockDocument = Utils.createDocumentWithCursor("|");
        const result: CompletionItem[] = await LanguageServices.getCompletionItems(document, document.cursorPosition);

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
        const result: CompletionItem[] = await LanguageServices.getCompletionItems(document, document.cursorPosition);
        expect(result.length).to.be.greaterThan(0);
    });
});

describe("Completion Items (error provider)", () => {
    //    LanguageServices.registerLibrarySymbolProvider(new ErrorProvider());

    // it("blank document keywords", async () => {
    //     const document: Utils.MockDocument = Utils.createDocumentWithCursor("|");
    //     const result: CompletionItem[] = await LanguageServices.getCompletionItems(document, document.cursorPosition);

    //     expect(result.length).to.be.greaterThan(0);

    //     result.forEach(item => {
    //         expect(item.kind).to.equal(CompletionItemKind.Keyword);
    //     });

    //     Utils.containsCompletionItem(result, "let");
    //     Utils.containsCompletionItem(result, "shared");
    //     Utils.containsCompletionItem(result, "#shared");
    // });
});
