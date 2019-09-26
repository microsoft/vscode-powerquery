// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, Hover, Position, Range, SignatureHelp, TextDocument } from "vscode-languageserver-types";

import * as Common from "./common";
import * as InspectionHelpers from "./inspectionHelpers";
import { KeywordProvider } from "./keywordProvider";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    LibrarySymbolProvider,
    NullLibrarySymbolProvider,
    SignatureProviderContext,
} from "./providers";
import * as WorkspaceCache from "./workspaceCache";

export interface Analysis {
    getCompletionItems(): Promise<CompletionItem[]>;
    getHover(): Promise<Hover>;
    getSignatureHelp(): Promise<SignatureHelp>;
}

export interface AnalysisOptions {
    librarySymbolProvider?: LibrarySymbolProvider;
}

export function createAnalysisSession(document: TextDocument, position: Position, options: AnalysisOptions): Analysis {
    return new DocumentAnalysis(document, position, options);
}

class DocumentAnalysis implements Analysis {
    private readonly document: TextDocument;
    private readonly keywordProvider: KeywordProvider;
    private readonly librarySymbolProvider: LibrarySymbolProvider;
    private readonly position: Position;

    constructor(document: TextDocument, position: Position, options: AnalysisOptions) {
        this.document = document;
        this.position = position;

        this.keywordProvider = new KeywordProvider();
        this.librarySymbolProvider = options.librarySymbolProvider
            ? options.librarySymbolProvider
            : new NullLibrarySymbolProvider();
    }

    public async getCompletionItems(): Promise<CompletionItem[]> {
        let context: CompletionItemProviderContext = {};

        const maybeToken: undefined | PQP.LineToken = maybeTokenAt(this.document, this.position);
        if (maybeToken !== undefined) {
            context = {
                range: getTokenRangeForPosition(maybeToken, this.position),
                text: maybeToken.data,
                tokenKind: maybeToken.kind,
            };
        }

        // TODO:
        // - get inspection for document level (to get top level queries)
        // - get inspection for current scope
        // - only include current query name after @
        // - don't return completion items when on lefthand side of assignment

        // TODO: add tracing/logging to the catch()
        // TODO: get symbols from current scope
        const getLibraryCompletionItems: Promise<CompletionItem[]> = this.librarySymbolProvider
            .getCompletionItems(context)
            .catch(() => {
                return Common.EmptyCompletionItems;
            });
        const getKeywords: Promise<CompletionItem[]> = this.keywordProvider.getCompletionItems(context).catch(() => {
            return Common.EmptyCompletionItems;
        });

        const [libraryResponse, keywordResponse] = await Promise.all([getLibraryCompletionItems, getKeywords]);

        let completionItems: CompletionItem[] = Array.isArray(keywordResponse) ? keywordResponse : [keywordResponse];
        completionItems = completionItems.concat(libraryResponse);

        return completionItems;
    }

    public async getHover(): Promise<Hover> {
        const identifierToken: PQP.LineToken | undefined = maybeIdentifierAt(this.document, this.position);
        if (identifierToken) {
            const context: HoverProviderContext = {
                range: getTokenRangeForPosition(identifierToken, this.position),
                identifier: identifierToken.data,
            };

            // TODO: add tracing/logging to the catch()
            const getLibraryHover: Promise<Hover | null> = this.librarySymbolProvider.getHover(context).catch(() => {
                // tslint:disable-next-line: no-null-keyword
                return null;
            });

            // TODO: use other providers
            // TODO: define priority when multiple providers return results
            const [libraryResponse] = await Promise.all([getLibraryHover]);
            if (libraryResponse) {
                return libraryResponse;
            }
        }

        return Common.EmptyHover;
    }

    public async getSignatureHelp(): Promise<SignatureHelp> {
        const triedInspection: PQP.Inspection.TriedInspect | undefined = WorkspaceCache.getInspection(
            this.document,
            this.position,
        );

        if (triedInspection && triedInspection.kind === PQP.ResultKind.Ok) {
            const inspected: PQP.Inspection.Inspected = triedInspection.value;
            const invokeExpression:
                | PQP.Inspection.InvokeExpression
                | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected);

            if (invokeExpression) {
                const context: SignatureProviderContext | undefined = InspectionHelpers.getContextForInvokeExpression(
                    invokeExpression,
                );
                if (context && context.functionName) {
                    // TODO: add tracing/logging to the catch()
                    const librarySignatureHelp: Promise<SignatureHelp | null> = this.librarySymbolProvider
                        .getSignatureHelp(context)
                        .catch(() => {
                            // tslint:disable-next-line: no-null-keyword
                            return null;
                        });

                    const [libraryResponse] = await Promise.all([librarySignatureHelp]);
                    if (libraryResponse) {
                        return libraryResponse;
                    }
                }
            }
        }

        return Common.EmptySignatureHelp;
    }
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
