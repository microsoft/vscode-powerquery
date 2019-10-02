// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import { CurrentDocumentSymbolProvider } from "../language-services/currentDocumentSymbolProvider";
import * as Utils from "./utils";

const totalKeywordCount: number = 24;
const libraryProvider: Utils.SimpleLibraryProvider = new Utils.SimpleLibraryProvider(["Text.NewGuid"]);

describe("Completion Items (null provider)", () => {
    it("blank document keywords", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|");

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItems(result, ["let", "shared", "#shared"]);
    });

    it("simple document", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("let\na = 12,\nb=4, c = 2\nin\n  |c");
        expect(result.length).to.equal(totalKeywordCount + 3);

        Utils.containsCompletionItems(result, ["a", "b", "c"]);
    });
});

describe("Completion Items (error provider)", () => {
    it("keywords still work", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", Utils.errorAnalysisOptions);

        expect(result.length).to.equal(totalKeywordCount);

        result.forEach(item => {
            expect(item.kind).to.equal(CompletionItemKind.Keyword);
        });

        Utils.containsCompletionItems(result, ["let", "shared", "#shared"]);
    });
});

describe("Completion Items (Simple provider)", () => {
    it("keywords still work with library provider", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            librarySymbolProvider: libraryProvider,
        });

        Utils.containsCompletionItems(result, ["Text.NewGuid", "let", "shared", "section"]);
    });

    it("keywords still work with environment provider", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            environmentSymbolProvider: libraryProvider,
        });

        Utils.containsCompletionItems(result, ["Text.NewGuid", "let", "shared", "section"]);
    });

    it("keywords still work with library and environment", async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems("|", {
            librarySymbolProvider: libraryProvider,
            environmentSymbolProvider: libraryProvider,
        });

        Utils.containsCompletionItems(result, ["Text.NewGuid", "let", "shared", "section"]);
    });
});

describe("Completion Items (Current Document Provider)", () => {
    it("DirectQueryForSQL file", async () => {
        const document: Utils.MockDocument = Utils.createDocumentFromFile("DirectQueryForSQL.pq");
        const provider: CurrentDocumentSymbolProvider = new CurrentDocumentSymbolProvider(document, {
            line: 40,
            character: 25,
        });

        const result: CompletionItem[] = await provider.getCompletionItems({});

        Utils.containsCompletionItems(result, [
            "ConnectionString",
            "Credential",
            "CredentialConnectionString",
            "Database",
            "DirectSQL",
            "DirectSQL.UI",
            "DirectSQL.Icons",
            "server",
            "database",
        ]);
    });

    it(`section foo; a = () => true; b = "string"; c = 1; d = |;`, async () => {
        const result: CompletionItem[] = await Utils.getCompletionItems(
            `section foo; a = () => true; b = "string"; c = 1; d = |;`,
        );

        Utils.containsCompletionItems(result, ["a", "b", "c", "let"]);
    });
});
