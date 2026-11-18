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

function compareSemanticTokens(left: PQLS.PartialSemanticToken, right: PQLS.PartialSemanticToken): number {
    const lineDiff: number = left.range.start.line - right.range.start.line;

    if (lineDiff !== 0) {
        return lineDiff;
    }

    const characterDiff: number = left.range.start.character - right.range.start.character;

    if (characterDiff !== 0) {
        return characterDiff;
    }

    const lengthDiff: number =
        right.range.end.character -
        right.range.start.character -
        (left.range.end.character - left.range.start.character);

    if (lengthDiff !== 0) {
        return lengthDiff;
    }

    if (left.tokenType === "function" && right.tokenType === "variable") {
        return -1;
    }

    if (left.tokenType === "variable" && right.tokenType === "function") {
        return 1;
    }

    const tokenTypeDiff: number =
        semanticTokenTypesLegend.indexOf(left.tokenType) - semanticTokenTypesLegend.indexOf(right.tokenType);

    if (tokenTypeDiff !== 0) {
        return tokenTypeDiff;
    }

    const leftModifiers: string = left.tokenModifiers.slice().sort().join("\0");
    const rightModifiers: string = right.tokenModifiers.slice().sort().join("\0");

    if (leftModifiers < rightModifiers) {
        return -1;
    }

    if (leftModifiers > rightModifiers) {
        return 1;
    }

    return 0;
}

function isValidSemanticToken(token: PQLS.PartialSemanticToken): boolean {
    const startLine: number = token.range.start.line;
    const startCharacter: number = token.range.start.character;
    const endLine: number = token.range.end.line;
    const endCharacter: number = token.range.end.character;

    return (
        Number.isSafeInteger(startLine) &&
        Number.isSafeInteger(startCharacter) &&
        Number.isSafeInteger(endLine) &&
        Number.isSafeInteger(endCharacter) &&
        startLine >= 0 &&
        startCharacter >= 0 &&
        endLine >= 0 &&
        endCharacter >= 0 &&
        startLine === endLine &&
        startCharacter < endCharacter &&
        semanticTokenTypesLegend.includes(token.tokenType)
    );
}

function normalizeSemanticTokens(
    tokens: ReadonlyArray<PQLS.PartialSemanticToken>,
): ReadonlyArray<PQLS.PartialSemanticToken> {
    const sorted: ReadonlyArray<PQLS.PartialSemanticToken> = tokens
        .filter(isValidSemanticToken)
        .slice()
        .sort(compareSemanticTokens);

    const normalized: PQLS.PartialSemanticToken[] = [];
    let previous: PQLS.PartialSemanticToken | undefined;

    for (const token of sorted) {
        if (
            previous !== undefined &&
            token.range.start.line === previous.range.end.line &&
            token.range.start.character < previous.range.end.character
        ) {
            continue;
        }

        normalized.push(token);
        previous = token;
    }

    return normalized;
}

export function encodeSemanticTokens(tokens: ReadonlyArray<PQLS.PartialSemanticToken>): number[] {
    const normalized: ReadonlyArray<PQLS.PartialSemanticToken> = normalizeSemanticTokens(tokens);
    const encoded: number[] = [];
    let prevLine: number = 0;
    let prevCharacter: number = 0;

    for (const token of normalized) {
        const tokenTypeIndex: number = semanticTokenTypesLegend.indexOf(token.tokenType);

        const length: number = token.range.end.character - token.range.start.character;
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
