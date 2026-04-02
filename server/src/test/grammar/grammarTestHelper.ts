// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import * as oniguruma from "vscode-oniguruma";
import * as path from "path";
import * as vsctm from "vscode-textmate";

const wasmBin: Buffer = fs.readFileSync(
    path.resolve(__dirname, "../../../node_modules/vscode-oniguruma/release/onig.wasm"),
);

const vscodeOnigurumaLib: Promise<vsctm.IOnigLib> = oniguruma.loadWASM({ data: wasmBin }).then(() => ({
    createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
    createOnigString: (s: string) => new oniguruma.OnigString(s),
}));

const grammarPath: string = path.resolve(__dirname, "../../../../syntaxes/powerquery.tmLanguage.json");

const registry: vsctm.Registry = new vsctm.Registry({
    onigLib: vscodeOnigurumaLib,
    // eslint-disable-next-line require-await
    loadGrammar: async (scopeName: string): Promise<vsctm.IRawGrammar | null> => {
        if (scopeName === "source.powerquery") {
            const grammarContent: string = fs.readFileSync(grammarPath, "utf-8");

            return vsctm.parseRawGrammar(grammarContent, grammarPath);
        }

        return null;
    },
});

let cachedGrammar: vsctm.IGrammar | null = null;

export interface TokenInfo {
    readonly text: string;
    readonly scopes: string[];
}

export async function getGrammar(): Promise<vsctm.IGrammar> {
    if (cachedGrammar) {
        return cachedGrammar;
    }

    const grammar: vsctm.IGrammar | null = await registry.loadGrammar("source.powerquery");

    if (!grammar) {
        throw new Error("Failed to load Power Query grammar");
    }

    // eslint-disable-next-line require-atomic-updates
    cachedGrammar = grammar;

    return grammar;
}

export async function tokenizeLine(text: string): Promise<TokenInfo[]> {
    const grammar: vsctm.IGrammar = await getGrammar();
    const result: vsctm.ITokenizeLineResult = grammar.tokenizeLine(text, vsctm.INITIAL);
    const tokens: TokenInfo[] = [];

    for (const token of result.tokens) {
        tokens.push({
            text: text.substring(token.startIndex, token.endIndex),
            scopes: token.scopes,
        });
    }

    return tokens;
}

export interface MultiLineTokenInfo {
    readonly line: number;
    readonly text: string;
    readonly scopes: string[];
}

export async function tokenizeLines(text: string): Promise<MultiLineTokenInfo[]> {
    const grammar: vsctm.IGrammar = await getGrammar();
    const lines: string[] = text.split(/\r?\n/);
    const allTokens: MultiLineTokenInfo[] = [];
    let ruleStack: vsctm.StateStack = vsctm.INITIAL;

    for (let i: number = 0; i < lines.length; i += 1) {
        const line: string = lines[i];
        const result: vsctm.ITokenizeLineResult = grammar.tokenizeLine(line, ruleStack);

        for (const token of result.tokens) {
            allTokens.push({
                line: i,
                text: line.substring(token.startIndex, token.endIndex),
                scopes: token.scopes,
            });
        }

        ruleStack = result.ruleStack;
    }

    return allTokens;
}

export function findToken(tokens: TokenInfo[], text: string): TokenInfo | undefined {
    return tokens.find((t: TokenInfo) => t.text === text);
}

export function findTokens(tokens: TokenInfo[], text: string): TokenInfo[] {
    return tokens.filter((t: TokenInfo) => t.text === text);
}

export function hasScope(token: TokenInfo, scope: string): boolean {
    return token.scopes.some((s: string) => s.includes(scope));
}

export function expectScope(token: TokenInfo | undefined, scope: string): void {
    if (!token) {
        throw new Error(`Token not found; expected scope "${scope}"`);
    }

    if (!hasScope(token, scope)) {
        throw new Error(
            `Expected scope "${scope}" in token "${token.text}", but found scopes: [${token.scopes.join(", ")}]`,
        );
    }
}

export function expectNoScope(token: TokenInfo | undefined, scope: string): void {
    if (!token) {
        throw new Error(`Token not found; expected no scope "${scope}"`);
    }

    if (hasScope(token, scope)) {
        throw new Error(
            `Expected no scope "${scope}" in token "${token.text}", but found scopes: [${token.scopes.join(", ")}]`,
        );
    }
}
