// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type * as LS from "vscode-languageserver/node";
import * as PQLS from "@microsoft/powerquery-language-services";

const semanticTokenTypesLegend: ReadonlyArray<string> = [
    "variable",
    "function",
    "parameter",
    "property",
    "keyword",
    "number",
    "string",
    "comment",
    "type",
    "namespace",
    "operator",
    "typeParameter",
    "modifier",
];

const semanticTokenModifiersLegend: ReadonlyArray<string> = [
    "declaration",
    "definition",
    "readonly",
    "defaultLibrary",
    "deprecated",
];

export const semanticTokensLegend: LS.SemanticTokensLegend = {
    tokenTypes: semanticTokenTypesLegend as string[],
    tokenModifiers: semanticTokenModifiersLegend as string[],
};

export function encodeSemanticTokens(tokens: ReadonlyArray<PQLS.PartialSemanticToken>): number[] {
    const sorted: ReadonlyArray<PQLS.PartialSemanticToken> = tokens
        .slice()
        .sort((left: PQLS.PartialSemanticToken, right: PQLS.PartialSemanticToken) => {
            const lineDiff: number = left.range.start.line - right.range.start.line;

            return lineDiff !== 0 ? lineDiff : left.range.start.character - right.range.start.character;
        });

    const encoded: number[] = [];
    let prevLine: number = 0;
    let prevCharacter: number = 0;

    for (const token of sorted) {
        const tokenTypeIndex: number = semanticTokenTypesLegend.indexOf(token.tokenType);

        if (tokenTypeIndex === -1) {
            continue;
        }

        // Skip multi-line tokens — LSP semantic tokens encoding requires single-line tokens
        if (token.range.end.line !== token.range.start.line) {
            continue;
        }

        const length: number = token.range.end.character - token.range.start.character;

        if (length <= 0) {
            continue;
        }

        const line: number = token.range.start.line;
        const character: number = token.range.start.character;
        const deltaLine: number = line - prevLine;
        const deltaStartCharacter: number = deltaLine === 0 ? character - prevCharacter : character;

        let tokenModifiersBitmask: number = 0;

        for (const modifier of token.tokenModifiers) {
            const index: number = semanticTokenModifiersLegend.indexOf(modifier);

            if (index !== -1) {
                tokenModifiersBitmask |= 1 << index;
            }
        }

        encoded.push(deltaLine, deltaStartCharacter, length, tokenTypeIndex, tokenModifiersBitmask);

        prevLine = line;
        prevCharacter = character;
    }

    return encoded;
}
