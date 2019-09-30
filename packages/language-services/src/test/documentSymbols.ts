// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";
import { DocumentSymbol, SymbolKind, TextDocument } from "vscode-languageserver-types";

import * as InspectionHelpers from "../language-services/inspectionHelpers";
import * as WorkspaceCache from "../language-services/workspaceCache";
import * as Utils from "./utils";

function getLexAndParseOk(document: TextDocument): PQP.LexAndParseOk {
    const triedLexAndParse: PQP.TriedLexAndParse = WorkspaceCache.getTriedLexAndParse(document);
    assert.isDefined(triedLexAndParse);
    expect(triedLexAndParse.kind).equals(PQP.ResultKind.Ok, "expected OK result");
    if (triedLexAndParse.kind === PQP.ResultKind.Ok) {
        return triedLexAndParse.value;
    }

    throw new Error("unexpected");
}

interface ExpectedDocumentSymbol {
    name: string;
    kind: SymbolKind;
}

function documentSymbolArrayToExpectedSymbols(documentSymbols: DocumentSymbol[]): ExpectedDocumentSymbol[] {
    const expectedSymbols: ExpectedDocumentSymbol[] = [];
    documentSymbols.forEach(element => {
        expectedSymbols.push({ name: element.name, kind: element.kind });
    });
    return expectedSymbols;
}

function expectSymbols(document: PQP.Ast.TDocument, expectedSymbols: ExpectedDocumentSymbol[]): void {
    let actualSymbols: ExpectedDocumentSymbol[];

    if (document.kind === PQP.Ast.NodeKind.Section) {
        const result: DocumentSymbol[] = InspectionHelpers.getSymbolsForSection(document);
        actualSymbols = documentSymbolArrayToExpectedSymbols(result);
    } else if (document.kind === PQP.Ast.NodeKind.LetExpression) {
        const result: DocumentSymbol[] = InspectionHelpers.getSymbolsForLetExpression(document);
        actualSymbols = documentSymbolArrayToExpectedSymbols(result);
    } else {
        throw new Error("unsupported code path");
    }

    assert.isDefined(actualSymbols);

    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.");
}

describe("Document symbols", () => {
    it(`section foo; shared a = 1; b = "abc"; c = true;`, () => {
        const document: Utils.MockDocument = Utils.createDocument(`section foo; shared a = 1; b = "abc"; c = true;`);
        const lexAndParseOk: PQP.LexAndParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Ast.NodeKind.Section);

        expectSymbols(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.String },
            { name: "c", kind: SymbolKind.Boolean },
        ]);
    });

    it(`section foo; a = {1,2};`, () => {
        const document: Utils.MockDocument = Utils.createDocument(`section foo; a = {1,2};`);
        const lexAndParseOk: PQP.LexAndParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Ast.NodeKind.Section);

        expectSymbols(lexAndParseOk.ast, [{ name: "a", kind: SymbolKind.Array }]);
    });

    it(`let a = 1, b = 2, c = 3 in c`, () => {
        const document: Utils.MockDocument = Utils.createDocument(`let a = 1, b = 2, c = 3 in c`);
        const lexAndParseOk: PQP.LexAndParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Ast.NodeKind.LetExpression);

        expectSymbols(lexAndParseOk.ast, [
            { name: "a", kind: SymbolKind.Number },
            { name: "b", kind: SymbolKind.Number },
            { name: "c", kind: SymbolKind.Number },
        ]);
    });

    it("HelloWorldWithDocs file", () => {
        const document: Utils.MockDocument = Utils.createDocumentFromFile("HelloWorldWithDocs.pq");
        const lexAndParseOk: PQP.LexAndParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Ast.NodeKind.Section);

        expectSymbols(lexAndParseOk.ast, [
            { name: "HelloWorldWithDocs.Contents", kind: SymbolKind.Variable },
            { name: "HelloWorldType", kind: SymbolKind.TypeParameter },
            { name: "HelloWorldImpl", kind: SymbolKind.Function },
            { name: "HelloWorldWithDocs", kind: SymbolKind.Struct },
            { name: "HelloWorldWithDocs.Publish", kind: SymbolKind.Struct },
        ]);
    });

    it("DirectQueryForSQL file", () => {
        const document: Utils.MockDocument = Utils.createDocumentFromFile("DirectQueryForSQL.pq");
        const lexAndParseOk: PQP.LexAndParseOk = getLexAndParseOk(document);

        expect(lexAndParseOk.ast.kind).to.equal(PQP.Ast.NodeKind.Section);

        expectSymbols(lexAndParseOk.ast, [
            { name: "DirectSQL.Database", kind: SymbolKind.Function },
            { name: "DirectSQL", kind: SymbolKind.Struct },
            { name: "DirectSQL.UI", kind: SymbolKind.Struct },
            { name: "DirectSQL.Icons", kind: SymbolKind.Struct },
        ]);
    });
});
