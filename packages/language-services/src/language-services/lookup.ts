// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, Hover, Position, Range, TextDocument } from "vscode-languageserver-types";

import * as Common from "./common";
import * as WorkspaceCache from "./workspaceCache";
import { LibrarySymbolProvider, NullLibrarySymbolProvider } from "./symbolProviders";

let librarySymbolProvider: LibrarySymbolProvider = new NullLibrarySymbolProvider();

export function registerLibrarySymbolProvider(provider: LibrarySymbolProvider) {
    if (!provider) {
        throw Error("provider value cannot be null or undefined.");
    }
    librarySymbolProvider = provider;
}

export async function getCompletionItems(document: TextDocument, position: Position): Promise<CompletionItem[]> {
    // TODO: determine other context values so we can be smarter about what is returned
    // TODO: include keywords
    // TODO: get symbols from current scope
    const getLibraryCompletionItems = librarySymbolProvider.getCompletionItems({});

    const [libraryResponse] = await Promise.all([getLibraryCompletionItems]);
    if (libraryResponse === null) {
        return Common.EmptyCompletionItems;
    }

    let completionItems: CompletionItem[] = libraryResponse;

    // TODO: Do we really need to adjust the range? should the symbol provider do it?
    const maybeToken: undefined | PQP.LineToken = maybeTokenAt(document, position);
    if (maybeToken !== undefined) {
        const range: Range = {
            start: {
                line: position.line,
                character: maybeToken.positionStart,
            },
            end: {
                line: position.line,
                character: maybeToken.positionEnd,
            },
        };

        completionItems = cloneCompletionItemsWithRange(completionItems, range);
    }

    return completionItems;
}

export async function getHover(document: TextDocument, position: Position): Promise<Hover> {
    const identifierToken: PQP.LineToken | undefined = maybeIdentifierAt(document, position);
    if (identifierToken) {
        // TODO: catch() failed promise
        const getLibraryHover = librarySymbolProvider.getHover(identifierToken.data, {});

        // TODO: use other providers
        // TODO: define priority when multiple providers return results
        const [libraryResponse] = await Promise.all([getLibraryHover]);
        if (libraryResponse != null) {
            return libraryResponse;
        }
    }

    return Common.EmptyHover;
}

function cloneCompletionItemsWithRange(completionItems: CompletionItem[], range: Range): CompletionItem[] {
    const result: CompletionItem[] = [];
    completionItems.forEach(item => {
        result.push({
            ...item,
            textEdit: {
                range: range,
                newText: item.label,
            },
        });
    });

    return result;
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
    const maybeLineTokens: undefined | ReadonlyArray<PQP.LineToken> = maybeLineTokensAt(
        document,
        position,
    );

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
