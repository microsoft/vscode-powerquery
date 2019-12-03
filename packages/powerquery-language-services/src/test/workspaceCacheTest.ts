// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";
import { TextDocument } from "vscode-languageserver-types";

import * as LanguageServices from "../language-services/index";
import * as WorkspaceCache from "../language-services/workspaceCache";
import * as Utils from "./utils";

describe("workspaceCache", () => {
    it("getLexerState", () => {
        const document: TextDocument = Utils.createDocument("let\n   b = 1\n   in b");
        const state: PQP.Lexer.State = WorkspaceCache.getLexerState(document);
        assert.isDefined(state);
        expect(state.lines.length).to.equal(3);
    });

    it("getTriedLexerSnapshot", () => {
        const document: TextDocument = Utils.createDocument("let a = 1 in a");
        const triedSnapshot: PQP.TriedLexerSnapshot = WorkspaceCache.getTriedLexerSnapshot(document);
        assert.isDefined(triedSnapshot);
        if (triedSnapshot.kind === PQP.ResultKind.Ok) {
            const snapshot: PQP.LexerSnapshot = triedSnapshot.value;
            expect(snapshot.tokens.length).to.equal(6);
        } else {
            assert.fail("triedSnapshot should be OK");
        }
    });

    it("getTriedLexParse", () => {
        const document: TextDocument = Utils.createDocument("let c = 1 in c");
        const triedLexParse: PQP.TriedLexParse = WorkspaceCache.getTriedLexParse(document);
        assert.isDefined(triedLexParse);
        if (triedLexParse.kind === PQP.ResultKind.Ok) {
            const lexParseOk: PQP.LexParseOk = triedLexParse.value;
            assert.isDefined(lexParseOk.ast);
        } else {
            assert.fail("triedLexParse should be OK");
        }
    });

    it("getTriedLexParse with error", () => {
        const document: TextDocument = Utils.createDocument("let c = 1, in c");
        const triedLexParse: PQP.TriedLexParse = WorkspaceCache.getTriedLexParse(document);
        assert.isDefined(triedLexParse);
        expect(triedLexParse.kind).to.equal(PQP.ResultKind.Err);
    });

    it("getInspection", () => {
        const [document, postion] = Utils.createDocumentWithMarker("let c = 1 in |c");
        const triedInspect: PQP.Inspection.TriedInspection | undefined = WorkspaceCache.getTriedInspection(
            document,
            postion,
        );
        if (triedInspect) {
            expect(triedInspect.kind).to.equal(PQP.ResultKind.Ok);
        } else {
            assert.isDefined(triedInspect);
        }
    });

    it("getInspection with parser error", () => {
        const [document, postion] = Utils.createDocumentWithMarker("let c = 1, in |");
        const triedInspect: PQP.Inspection.TriedInspection | undefined = WorkspaceCache.getTriedInspection(
            document,
            postion,
        );
        if (triedInspect) {
            expect(triedInspect.kind).to.equal(PQP.ResultKind.Ok);
        } else {
            assert.isDefined(triedInspect);
        }
    });
});

describe("top level workspace functions", () => {
    it("document operations", () => {
        const document: TextDocument = Utils.createDocument("let c = 1 in c");
        LanguageServices.documentUpdated(document);
        LanguageServices.documentUpdated(document);
        LanguageServices.documentClosed(document);
        LanguageServices.documentClosed(document);
        LanguageServices.documentUpdated(document);
    });
});
