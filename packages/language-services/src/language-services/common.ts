// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, Hover, Position, Range, SignatureHelp } from "vscode-languageserver-types";

export const EmptyCompletionItems: CompletionItem[] = [];

export const EmptyHover: Hover = {
    range: undefined,
    contents: [],
};

export const EmptySignatureHelp: SignatureHelp = {
    signatures: [],
    // tslint:disable-next-line: no-null-keyword
    activeParameter: null,
    activeSignature: 0,
};

export function tokenPositionToPosition(tokenPosition: PQP.TokenPosition): Position {
    return {
        line: tokenPosition.lineNumber,
        character: tokenPosition.lineCodeUnit,
    };
}

export function tokenPositionToRange(
    startTokenPosition: PQP.TokenPosition | undefined,
    endTokenPosition: PQP.TokenPosition | undefined,
): Range | undefined {
    if (startTokenPosition && endTokenPosition) {
        return {
            start: tokenPositionToPosition(startTokenPosition),
            end: tokenPositionToPosition(endTokenPosition),
        };
    }

    return undefined;
}
