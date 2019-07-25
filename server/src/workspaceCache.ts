// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as LS from "vscode-languageserver";

const lexerSnapshotCache: Map<string, PQP.TriedLexerSnapshot> = new Map();
const lexerStateCache: Map<string, PQP.Lexer.State> = new Map();
const triedLexAndParseCache: Map<string, PQP.TriedLexAndParse> = new Map();

const allCaches: Map<string, any>[] = [lexerSnapshotCache, lexerStateCache, triedLexAndParseCache];

export function close(textDocument: LS.TextDocument): void {
    allCaches.forEach(map => {
        map.delete(textDocument.uri);
    });
}

export function reset(textDocument: LS.TextDocument): void {
    // TODO: support incremental lexing
    // TODO: premptively prepare cache on background thread?
    close(textDocument);
}

export function getLexerState(textDocument: LS.TextDocument): PQP.Lexer.State {
    let lexerState: PQP.Lexer.State | undefined = lexerStateCache.get(textDocument.uri);
    if (lexerState === undefined) {
        lexerState = PQP.Lexer.stateFrom(textDocument.getText());
        lexerStateCache.set(textDocument.uri, lexerState);
    }

    return lexerState;
}

export function getTriedLexerSnapshot(textDocument: LS.TextDocument): PQP.TriedLexerSnapshot {
    let lexerSnapshot: PQP.TriedLexerSnapshot | undefined = lexerSnapshotCache.get(textDocument.uri);
    if (lexerSnapshot === undefined) {
        lexerSnapshot = PQP.LexerSnapshot.tryFrom(getLexerState(textDocument));
        lexerSnapshotCache.set(textDocument.uri, lexerSnapshot);
    }

    return lexerSnapshot;
}

export function getTriedLexAndParse(textDocument: LS.TextDocument): PQP.TriedLexAndParse {
    let triedLexAndParse: PQP.TriedLexAndParse | undefined = triedLexAndParseCache.get(textDocument.uri);
    if (triedLexAndParse === undefined) {
        const lexerSnapshot: PQP.TriedLexerSnapshot = getTriedLexerSnapshot(textDocument);

        if (lexerSnapshot.kind === PQP.ResultKind.Ok) {
            const triedParse: PQP.Parser.TriedParse = PQP.Parser.tryParse(lexerSnapshot.value);
            if (triedParse.kind === PQP.ResultKind.Ok) {
                triedLexAndParse = {
                    kind: PQP.ResultKind.Ok,
                    value: {
                        ast: triedParse.value.document,
                        comments: lexerSnapshot.value.comments,
                        nodeIdMapCollection: triedParse.value.nodeIdMapCollection,
                    },
                };
            } else {
                triedLexAndParse = {
                    kind: PQP.ResultKind.Err,
                    error: triedParse.error,
                };
            }
        } else {
            triedLexAndParse = {
                kind: PQP.ResultKind.Err,
                error: lexerSnapshot.error,
            };
        }

        triedLexAndParseCache.set(textDocument.uri, triedLexAndParse);
    }

    return triedLexAndParse;
}
