import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";
import { DocumentSymbol, SymbolKind, TextDocument } from "vscode-languageserver-types";

import * as Common from "../language-services/common";
import * as WorkspaceCache from "../language-services/workspaceCache";
import * as Utils from "./utils";

// tslint:disable: no-unnecessary-type-assertion

function getLexAndParseOk(document: TextDocument): PQP.LexAndParseOk {
    const triedLexAndParse: PQP.TriedLexAndParse = WorkspaceCache.getTriedLexAndParse(document);
    assert.isDefined(triedLexAndParse);
    expect(triedLexAndParse.kind).equals(PQP.ResultKind.Ok, "expected OK result");
    if (triedLexAndParse.kind === PQP.ResultKind.Ok) {
        return triedLexAndParse.value;
    }

    throw new Error("unexpected");
}

function getSymbolKindForLiteralExpression(node: PQP.Ast.LiteralExpression): SymbolKind {
    switch (node.literalKind) {
        case PQP.Ast.LiteralKind.List:
            return SymbolKind.Array;

        case PQP.Ast.LiteralKind.Logical:
            return SymbolKind.Boolean;

        case PQP.Ast.LiteralKind.Null:
            return SymbolKind.Null;

        case PQP.Ast.LiteralKind.Numeric:
            return SymbolKind.Number;

        case PQP.Ast.LiteralKind.Record:
            return SymbolKind.Struct;

        case PQP.Ast.LiteralKind.Str:
            return SymbolKind.String;

        default:
            return PQP.isNever(node.literalKind);
    }
}

function getSymbolKindFromExpression(node: PQP.Ast.INode): SymbolKind {
    switch (node.kind) {
        case PQP.Ast.NodeKind.Constant:
            return SymbolKind.Constant;

        case PQP.Ast.NodeKind.FunctionExpression:
            return SymbolKind.Function;

        case PQP.Ast.NodeKind.ListExpression:
            return SymbolKind.Array;

        case PQP.Ast.NodeKind.LiteralExpression:
            return getSymbolKindForLiteralExpression(node as PQP.Ast.LiteralExpression);

        case PQP.Ast.NodeKind.MetadataExpression:
            return SymbolKind.TypeParameter;

        case PQP.Ast.NodeKind.RecordExpression:
            return SymbolKind.Struct;

        default:
            return SymbolKind.Variable;
    }
}

function getSymbolForIdentifierPairedExpression(
    identifierPairedExpressionNode: PQP.Ast.IdentifierPairedExpression,
): DocumentSymbol {
    return {
        kind: getSymbolKindFromExpression(identifierPairedExpressionNode.value),
        deprecated: false,
        name: identifierPairedExpressionNode.key.literal,
        range: Common.tokenRangeToRange(identifierPairedExpressionNode.tokenRange),
        selectionRange: Common.tokenRangeToRange(identifierPairedExpressionNode.key.tokenRange),
    };
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
    if (document.kind === PQP.Ast.NodeKind.Section) {
        const actualSymbols: DocumentSymbol[] = getSymbolsForSection(document);
        const converted: ExpectedDocumentSymbol[] = documentSymbolArrayToExpectedSymbols(actualSymbols);
        expect(converted).deep.equals(expectedSymbols, "Expected document symbols to match.");
    } else {
        throw new Error("unsupported code path");
    }
}

function getSymbolsForSection(sectionNode: PQP.Ast.Section): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];

    for (const member of sectionNode.sectionMembers.elements) {
        const memberSymbol: DocumentSymbol = getSymbolForIdentifierPairedExpression(member.namePairedExpression);
        documentSymbols.push(memberSymbol);
    }

    return documentSymbols;
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
});
