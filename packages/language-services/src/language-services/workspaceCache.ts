// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Position, TextDocument } from "vscode-languageserver-types";

const lexerSnapshotCache: Map<string, PQP.TriedLexerSnapshot> = new Map();
const lexerStateCache: Map<string, PQP.Lexer.State> = new Map();
const triedLexAndParseCache: Map<string, PQP.TriedLexAndParse> = new Map();

const allCaches: Map<string, any>[] = [lexerSnapshotCache, lexerStateCache, triedLexAndParseCache];

interface Inspectable {
    nodeIdMapCollection: PQP.NodeIdMap.Collection;
    leafNodeIds: ReadonlyArray<number>;
}

export function close(textDocument: TextDocument): void {
    allCaches.forEach(map => {
        map.delete(textDocument.uri);
    });
}

export function update(textDocument: TextDocument): void {
    // TODO: support incremental lexing
    // TODO: premptively prepare cache on background thread?
    // TODO: use document version
    close(textDocument);
}

export function getLexerState(textDocument: TextDocument): PQP.Lexer.State {
    let lexerState: PQP.Lexer.State | undefined = lexerStateCache.get(textDocument.uri);
    if (lexerState === undefined) {
        lexerState = PQP.Lexer.stateFrom(textDocument.getText());
        lexerStateCache.set(textDocument.uri, lexerState);
    }

    return lexerState;
}

export function getTriedLexerSnapshot(textDocument: TextDocument): PQP.TriedLexerSnapshot {
    let lexerSnapshot: PQP.TriedLexerSnapshot | undefined = lexerSnapshotCache.get(textDocument.uri);
    if (lexerSnapshot === undefined) {
        lexerSnapshot = PQP.LexerSnapshot.tryFrom(getLexerState(textDocument));
        lexerSnapshotCache.set(textDocument.uri, lexerSnapshot);
    }

    return lexerSnapshot;
}

export function getTriedLexAndParse(textDocument: TextDocument): PQP.TriedLexAndParse {
    let triedLexAndParse: PQP.TriedLexAndParse | undefined = triedLexAndParseCache.get(textDocument.uri);
    if (triedLexAndParse === undefined) {
        const lexerSnapshot: PQP.TriedLexerSnapshot = getTriedLexerSnapshot(textDocument);

        if (lexerSnapshot.kind === PQP.ResultKind.Ok) {
            const triedParse: PQP.TriedParse = getTriedParseFromSnapshot(lexerSnapshot.value);
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

export function getInspection(
    textDocument: TextDocument,
    position: Position,
): PQP.Inspection.TriedInspection | undefined {
    // TODO: triedLexAndParse doesn't have a leafNodeIds member so we can't pass it to Inspection.
    // We have to retrieve the snapshot and reparse ourselves.
    const triedSnapshot: PQP.TriedLexerSnapshot = getTriedLexerSnapshot(textDocument);

    if (triedSnapshot.kind === PQP.ResultKind.Ok) {
        const triedParser: PQP.TriedParse = getTriedParseFromSnapshot(triedSnapshot.value);
        let inspectableParser: Inspectable | undefined;
        if (triedParser.kind === PQP.ResultKind.Ok) {
            inspectableParser = triedParser.value;
        } else if (triedParser.error instanceof PQP.ParserError.ParserError) {
            inspectableParser = triedParser.error.context;
        }

        if (inspectableParser) {
            const inspectionPosition: PQP.Inspection.Position = {
                lineNumber: position.line,
                lineCodeUnit: position.character,
            };

            return PQP.Inspection.tryFrom(
                inspectionPosition,
                inspectableParser.nodeIdMapCollection,
                inspectableParser.leafNodeIds,
            );
        }
    }

    return undefined;
}

export function getRootNodeForDocument(textDocument: TextDocument): PQP.Ast.TDocument | undefined {
    const triedLexAndParse: PQP.TriedLexAndParse = getTriedLexAndParse(textDocument);
    if (triedLexAndParse.kind === PQP.ResultKind.Ok) {
        return triedLexAndParse.value.ast;
    } else if (triedLexAndParse.error instanceof PQP.ParserError.ParserError) {
        // TODO: can we still get document symbols on parser error?
        return undefined;
    }

    return undefined;
}

function getTriedParseFromSnapshot(lexerSnapshot: PQP.LexerSnapshot): PQP.TriedParse {
    const parserState: PQP.IParserState = PQP.IParserStateUtils.newState(lexerSnapshot);
    return PQP.Parser.RecursiveDescentParser.readDocument(parserState, PQP.Parser.RecursiveDescentParser);
}
