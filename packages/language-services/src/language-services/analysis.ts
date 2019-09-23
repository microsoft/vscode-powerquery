// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, Hover, Position, Range, SignatureHelp, TextDocument } from "vscode-languageserver-types";

import * as Common from "./common";
import * as WorkspaceCache from "./workspaceCache";
import {
    LibrarySymbolProvider,
    NullLibrarySymbolProvider,
    SignatureProviderContext,
    ProviderContext,
    CompletionItemProviderContext,
} from "./symbolProviders";
import { KeywordProvider } from "./keywordProvider";

export interface Analysis {
    getCompletionItems(position: Position): Promise<CompletionItem[]>;
    getHover(position: Position): Promise<Hover>;
    getSignatureHelp(position: Position): Promise<SignatureHelp>;
}

export interface AnalysisOptions {
    librarySymbolProvider?: LibrarySymbolProvider;
}

export function createAnalysisSession(document: TextDocument, options: AnalysisOptions): Analysis {
    return new DocumentAnalysis(document, options);
}

class DocumentAnalysis implements Analysis {
    private readonly document: TextDocument;
    private readonly keywordProvider: KeywordProvider;
    private readonly librarySymbolProvider: LibrarySymbolProvider;

    constructor(document: TextDocument, options: AnalysisOptions) {
        this.document = document;

        this.keywordProvider = new KeywordProvider();
        this.librarySymbolProvider = options.librarySymbolProvider
            ? options.librarySymbolProvider
            : new NullLibrarySymbolProvider();
    }

    public async getCompletionItems(position: Position): Promise<CompletionItem[]> {
        let context: CompletionItemProviderContext = {};

        const maybeToken: undefined | PQP.LineToken = maybeTokenAt(this.document, position);
        if (maybeToken !== undefined) {
            context = {
                range: getTokenRangeForPosition(maybeToken, position),
                text: maybeToken.data,
                tokenKind: maybeToken.kind,
            };
        }

        // TODO: catch errors
        // TODO: get symbols from current scope
        const getLibraryCompletionItems = this.librarySymbolProvider.getCompletionItems(context);
        const getKeywords = this.keywordProvider.getCompletionItems(context);

        // TODO: add tracing/logging to the catch()
        const [libraryResponse, keywordResponse] = await Promise.all([getLibraryCompletionItems, getKeywords]);

        let completionItems: CompletionItem[] = Array.isArray(keywordResponse) ? keywordResponse : [keywordResponse];
        completionItems = completionItems.concat(libraryResponse);

        return completionItems;
    }

    public async getHover(position: Position): Promise<Hover> {
        const identifierToken: PQP.LineToken | undefined = maybeIdentifierAt(this.document, position);
        if (identifierToken) {
            const context: ProviderContext = {
                range: getTokenRangeForPosition(identifierToken, position),
            };

            // TODO: catch() failed promise
            const getLibraryHover = this.librarySymbolProvider.getHover(identifierToken.data, context);

            // TODO: use other providers
            // TODO: define priority when multiple providers return results
            const [libraryResponse] = await Promise.all([getLibraryHover]);
            if (libraryResponse != null) {
                return libraryResponse;
            }
        }

        return Common.EmptyHover;
    }

    public async getSignatureHelp(position: Position): Promise<SignatureHelp> {
        // TODO: triedLexAndParse doesn't have a leafNodeIds member so we can't pass it to Inspection.
        // We have to retrieve the snapshot and reparse ourselves.
        const triedSnapshot: PQP.TriedLexerSnapshot = WorkspaceCache.getTriedLexerSnapshot(this.document);

        if (triedSnapshot.kind === PQP.ResultKind.Ok) {
            const triedParser: PQP.Parser.TriedParse = PQP.Parser.tryParse(triedSnapshot.value);
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

                const triedInspection: PQP.Inspection.TriedInspect = PQP.Inspection.tryFrom(
                    inspectionPosition,
                    inspectableParser.nodeIdMapCollection,
                    inspectableParser.leafNodeIds,
                );

                if (triedInspection.kind === PQP.ResultKind.Ok) {
                    if (triedInspection.value.nodes.length > 0) {
                        // TODO: not sure if taking the first node is correct
                        const node: PQP.Inspection.TNode = triedInspection.value.nodes[0];
                        if (node.kind === PQP.Inspection.NodeKind.InvokeExpression) {
                            const invokeExpressionNode: PQP.Inspection.InvokeExpression = node;
                            const functionName: string | undefined = invokeExpressionNode.maybeName;
                            if (functionName) {
                                let argumentOrdinal: number | undefined;
                                if (invokeExpressionNode.maybeArguments) {
                                    argumentOrdinal = invokeExpressionNode.maybeArguments.positionArgumentIndex;
                                }

                                const context: SignatureProviderContext = {
                                    argumentOrdinal,
                                };

                                const librarySignatureHelp = this.librarySymbolProvider.getSignatureHelp(functionName, context);
                                const [libraryResponse] = await Promise.all([librarySignatureHelp]);

                                if (libraryResponse != null) {
                                    return libraryResponse;
                                }
                            }
                        }
                    }
                }
            }
        }

        return Common.EmptySignatureHelp;
    }
}

interface Inspectable {
    nodeIdMapCollection: PQP.NodeIdMap.Collection;
    leafNodeIds: ReadonlyArray<number>;
}

function getTokenRangeForPosition(token: PQP.LineToken, cursorPosition: Position): Range {
    return {
        start: {
            line: cursorPosition.line,
            character: token.positionStart,
        },
        end: {
            line: cursorPosition.line,
            character: token.positionEnd,
        },
    };
}

function maybeIdentifierAt(document: TextDocument, position: Position): undefined | PQP.LineToken {
    const maybeToken: undefined | PQP.LineToken = maybeTokenAt(document, position);
    if (maybeToken) {
        const token: PQP.LineToken = maybeToken;
        if (token.kind === PQP.LineTokenKind.Identifier) {
            return token;
        }
    }

    return undefined;
}

function maybeLineTokensAt(document: TextDocument, position: Position): undefined | ReadonlyArray<PQP.LineToken> {
    const lexResult: PQP.Lexer.State = WorkspaceCache.getLexerState(document);
    const maybeLine: undefined | PQP.Lexer.TLine = lexResult.lines[position.line];

    return maybeLine !== undefined ? maybeLine.tokens : undefined;
}

function maybeTokenAt(document: TextDocument, position: Position): undefined | PQP.LineToken {
    const maybeLineTokens: undefined | ReadonlyArray<PQP.LineToken> = maybeLineTokensAt(document, position);

    if (maybeLineTokens === undefined) {
        return undefined;
    }

    const lineTokens: ReadonlyArray<PQP.LineToken> = maybeLineTokens;

    for (const token of lineTokens) {
        if (token.positionStart <= position.character && token.positionEnd >= position.character) {
            return token;
        }
    }

    // Token wasn't found - check for special case where current position is a trailing "." on an identifier
    const currentRange: Range = {
        start: {
            line: position.line,
            character: position.character - 1,
        },
        end: position,
    };

    if (document.getText(currentRange) === ".") {
        for (const token of lineTokens) {
            if (token.positionStart <= position.character - 1 && token.positionEnd >= position.character - 1) {
                if (token.kind === PQP.LineTokenKind.Identifier) {
                    // Use this token with an adjusted position
                    return {
                        data: `${token.data}.`,
                        kind: token.kind,
                        positionStart: token.positionStart,
                        positionEnd: token.positionEnd + 1,
                    };
                }
            }
        }
    }

    return undefined;
}
