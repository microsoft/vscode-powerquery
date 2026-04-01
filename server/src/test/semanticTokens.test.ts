// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { encodeSemanticTokens, semanticTokensLegend } from "../semanticTokens";
import { LibrarySymbolUtils, LibraryUtils } from "../library";

const defaultLibrary: PQLS.Library.ILibrary = LibraryUtils.createLibrary(
    [LibrarySymbolUtils.getSymbolsForLocaleAndMode(PQP.Locale.en_US, "Power Query")],
    [],
);

class NoOpCancellationToken implements PQP.ICancellationToken {
    isCancelled: () => boolean = () => false;
    throwIfCancelled: () => void = () => {};
    cancel: () => void = () => {};
}

const NoOpCancellationTokenInstance: NoOpCancellationToken = new NoOpCancellationToken();

function createAnalysis(text: string): PQLS.Analysis {
    const analysisSettings: PQLS.AnalysisSettings = {
        inspectionSettings: PQLS.InspectionUtils.inspectionSettings(PQP.DefaultSettings, {
            library: defaultLibrary,
        }),
        isWorkspaceCacheAllowed: false,
        traceManager: PQP.Trace.NoOpTraceManagerInstance,
        initialCorrelationId: undefined,
    };

    return PQLS.AnalysisUtils.analysis(PQLS.textDocument("", 1, text), analysisSettings);
}

async function getPartialSemanticTokens(text: string): Promise<ReadonlyArray<PQLS.PartialSemanticToken>> {
    const analysis: PQLS.Analysis = createAnalysis(text);

    const result: PQP.Result<ReadonlyArray<PQLS.PartialSemanticToken> | undefined, PQP.CommonError.CommonError> =
        await analysis.getPartialSemanticTokens(NoOpCancellationTokenInstance);

    PQP.ResultUtils.assertIsOk(result);

    return result.value ?? [];
}

interface AbridgedSemanticToken {
    readonly tokenType: string;
    readonly tokenModifiers: ReadonlyArray<string>;
    readonly range: string;
}

function abridgeToken(token: PQLS.PartialSemanticToken): AbridgedSemanticToken {
    return {
        tokenType: token.tokenType,
        tokenModifiers: token.tokenModifiers,
        range: `${token.range.start.line}:${token.range.start.character}-${token.range.end.line}:${token.range.end.character}`,
    };
}

function abridgeTokens(tokens: ReadonlyArray<PQLS.PartialSemanticToken>): ReadonlyArray<AbridgedSemanticToken> {
    return tokens.map(abridgeToken);
}

/** Sort tokens by position for deterministic assertions. */
function sortByPosition(tokens: ReadonlyArray<AbridgedSemanticToken>): ReadonlyArray<AbridgedSemanticToken> {
    return tokens.slice().sort((a: AbridgedSemanticToken, b: AbridgedSemanticToken) => {
        const [aStartLine, aStartChar]: ReadonlyArray<number> = a.range.split("-")[0].split(":").map(Number);
        const [bStartLine, bStartChar]: ReadonlyArray<number> = b.range.split("-")[0].split(":").map(Number);
        const lineDiff: number = aStartLine - bStartLine;

        return lineDiff !== 0 ? lineDiff : aStartChar - bStartChar;
    });
}

describe("semanticTokens", () => {
    describe("semanticTokensLegend", () => {
        it("includes all expected token types", () => {
            const expected: ReadonlyArray<string> = [
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

            expect(semanticTokensLegend.tokenTypes).to.deep.equal(expected);
        });

        it("includes all expected token modifiers", () => {
            const expected: ReadonlyArray<string> = [
                "declaration",
                "definition",
                "readonly",
                "defaultLibrary",
                "deprecated",
            ];

            expect(semanticTokensLegend.tokenModifiers).to.deep.equal(expected);
        });
    });

    describe("getPartialSemanticTokens", () => {
        it("returns empty tokens for empty input", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens("");
            expect(tokens).to.deep.equal([]);
        });

        // let x = 1 in x
        //  0123456789...
        it("tokenizes a simple let expression", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens("let x = 1 in x");

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // let
                { tokenType: "keyword", tokenModifiers: [], range: "0:0-0:3" },
                // x (decl)
                { tokenType: "variable", tokenModifiers: ["declaration", "readonly"], range: "0:4-0:5" },
                // 1
                { tokenType: "number", tokenModifiers: [], range: "0:8-0:9" },
                // in
                { tokenType: "keyword", tokenModifiers: [], range: "0:10-0:12" },
                // x (ref)
                { tokenType: "variable", tokenModifiers: [], range: "0:13-0:14" },
            ]);
        });

        it("tokenizes a string literal", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens('"hello"');

            expect(abridgeTokens(tokens)).to.deep.equal([
                { tokenType: "string", tokenModifiers: [], range: "0:0-0:7" },
            ]);
        });

        it("tokenizes a library reference", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens("List.Count");

            expect(abridgeTokens(tokens)).to.deep.equal([
                { tokenType: "variable", tokenModifiers: ["defaultLibrary"], range: "0:0-0:10" },
            ]);
        });

        it("tokenizes a library function invocation", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens("List.Count({1})");

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // List.Count (invocation)
                { tokenType: "function", tokenModifiers: [], range: "0:0-0:10" },
                // List.Count (library ref)
                { tokenType: "variable", tokenModifiers: ["defaultLibrary"], range: "0:0-0:10" },
                // 1
                { tokenType: "number", tokenModifiers: [], range: "0:12-0:13" },
            ]);
        });

        it("tokenizes a multi-line let expression", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens(
                "let\n    x = 1,\n    y = x + 2\nin\n    y",
            );

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // let
                { tokenType: "keyword", tokenModifiers: [], range: "0:0-0:3" },
                // x (decl)
                { tokenType: "variable", tokenModifiers: ["declaration", "readonly"], range: "1:4-1:5" },
                // 1
                { tokenType: "number", tokenModifiers: [], range: "1:8-1:9" },
                // y (decl)
                { tokenType: "variable", tokenModifiers: ["declaration", "readonly"], range: "2:4-2:5" },
                // x (ref)
                { tokenType: "variable", tokenModifiers: [], range: "2:8-2:9" },
                // +
                { tokenType: "operator", tokenModifiers: [], range: "2:10-2:11" },
                // 2
                { tokenType: "number", tokenModifiers: [], range: "2:12-2:13" },
                // in
                { tokenType: "keyword", tokenModifiers: [], range: "3:0-3:2" },
                // y (ref)
                { tokenType: "variable", tokenModifiers: [], range: "4:4-4:5" },
            ]);
        });

        it("tokenizes mixed types on a single line", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens(
                'let x = 1, y = "hello" in x + y',
            );

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // let
                { tokenType: "keyword", tokenModifiers: [], range: "0:0-0:3" },
                // x (decl)
                { tokenType: "variable", tokenModifiers: ["declaration", "readonly"], range: "0:4-0:5" },
                // 1
                { tokenType: "number", tokenModifiers: [], range: "0:8-0:9" },
                // y (decl)
                { tokenType: "variable", tokenModifiers: ["declaration", "readonly"], range: "0:11-0:12" },
                // "hello"
                { tokenType: "string", tokenModifiers: [], range: "0:15-0:22" },
                // in
                { tokenType: "keyword", tokenModifiers: [], range: "0:23-0:25" },
                // x (ref)
                { tokenType: "variable", tokenModifiers: [], range: "0:26-0:27" },
                // +
                { tokenType: "operator", tokenModifiers: [], range: "0:28-0:29" },
                // y (ref)
                { tokenType: "variable", tokenModifiers: [], range: "0:30-0:31" },
            ]);
        });

        // let f = (x) => x in f(1)
        // 0         1         2
        // 0123456789012345678901234
        it("tokenizes function parameters", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> =
                await getPartialSemanticTokens("let f = (x) => x in f(1)");

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // let
                { tokenType: "keyword", tokenModifiers: [], range: "0:0-0:3" },
                // f (decl)
                { tokenType: "function", tokenModifiers: ["declaration", "readonly"], range: "0:4-0:5" },
                // x (parameter decl)
                { tokenType: "parameter", tokenModifiers: ["declaration"], range: "0:9-0:10" },
                // x (ref in body)
                { tokenType: "variable", tokenModifiers: [], range: "0:15-0:16" },
                // in
                { tokenType: "keyword", tokenModifiers: [], range: "0:17-0:19" },
                // f (invocation)
                { tokenType: "function", tokenModifiers: [], range: "0:20-0:21" },
                // f (ref)
                { tokenType: "variable", tokenModifiers: [], range: "0:20-0:21" },
                // 1
                { tokenType: "number", tokenModifiers: [], range: "0:22-0:23" },
            ]);
        });

        // let f = (x as number) => x in f(1)
        // 0         1         2         3
        // 0123456789012345678901234567890123
        it("tokenizes typed function parameters with type annotations", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens(
                "let f = (x as number) => x in f(1)",
            );

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // let
                { tokenType: "keyword", tokenModifiers: [], range: "0:0-0:3" },
                // f (decl)
                { tokenType: "function", tokenModifiers: ["declaration", "readonly"], range: "0:4-0:5" },
                // x (parameter decl)
                { tokenType: "parameter", tokenModifiers: ["declaration"], range: "0:9-0:10" },
                // as
                { tokenType: "keyword", tokenModifiers: [], range: "0:11-0:13" },
                // number (type annotation)
                { tokenType: "type", tokenModifiers: [], range: "0:14-0:20" },
                // x (ref in body)
                { tokenType: "variable", tokenModifiers: [], range: "0:25-0:26" },
                // in
                { tokenType: "keyword", tokenModifiers: [], range: "0:27-0:29" },
                // f (invocation)
                { tokenType: "function", tokenModifiers: [], range: "0:30-0:31" },
                // f (ref)
                { tokenType: "variable", tokenModifiers: [], range: "0:30-0:31" },
                // 1
                { tokenType: "number", tokenModifiers: [], range: "0:32-0:33" },
            ]);
        });

        it("tokenizes type assertions", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens("1 as number");

            expect(sortByPosition(abridgeTokens(tokens))).to.deep.equal([
                // 1
                { tokenType: "number", tokenModifiers: [], range: "0:0-0:1" },
                // as
                { tokenType: "keyword", tokenModifiers: [], range: "0:2-0:4" },
                // number
                { tokenType: "type", tokenModifiers: [], range: "0:5-0:11" },
            ]);
        });
    });

    describe("encodeSemanticTokens", () => {
        it("returns empty array for empty input", () => {
            expect(encodeSemanticTokens([])).to.deep.equal([]);
        });

        it("encodes real tokens from a let expression", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens("let x = 1 in x");

            const encoded: ReadonlyArray<number> = encodeSemanticTokens(tokens);

            // Each token produces 5 numbers: [deltaLine, deltaStartChar, length, tokenTypeIndex, modifiersBitmask]
            expect(encoded.length % 5).to.equal(0);
            expect(encoded.length).to.be.greaterThan(0);

            // All values should be non-negative integers
            for (const value of encoded) {
                expect(value).to.be.at.least(0);
                expect(Number.isInteger(value)).to.equal(true);
            }
        });

        it("produces monotonically increasing positions when decoded", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens(
                "let\n    x = 1,\n    y = x + 2\nin\n    y",
            );

            const encoded: ReadonlyArray<number> = encodeSemanticTokens(tokens);

            let absoluteLine: number = 0;
            let absoluteChar: number = 0;
            let prevLine: number = -1;
            let prevChar: number = -1;

            for (let i: number = 0; i < encoded.length; i += 5) {
                const deltaLine: number = encoded[i];
                const deltaChar: number = encoded[i + 1];

                absoluteLine += deltaLine;
                absoluteChar = deltaLine === 0 ? absoluteChar + deltaChar : deltaChar;

                if (absoluteLine === prevLine) {
                    expect(absoluteChar).to.be.greaterThan(prevChar, "tokens on same line must advance in character");
                } else {
                    expect(absoluteLine).to.be.greaterThan(prevLine, "tokens must advance in line");
                }

                prevLine = absoluteLine;
                prevChar = absoluteChar;
            }
        });

        it("all token type indices are within legend bounds", async () => {
            const tokens: ReadonlyArray<PQLS.PartialSemanticToken> = await getPartialSemanticTokens(
                'let x = 1, y = "hello" in x + y',
            );

            const encoded: ReadonlyArray<number> = encodeSemanticTokens(tokens);

            for (let i: number = 3; i < encoded.length; i += 5) {
                expect(encoded[i]).to.be.at.least(0);
                expect(encoded[i]).to.be.lessThan(semanticTokensLegend.tokenTypes.length);
            }
        });

        it("does not mutate the input array", async () => {
            const tokens: PQLS.PartialSemanticToken[] = [...(await getPartialSemanticTokens("let x = 1 in x"))];

            const originalFirst: PQLS.PartialSemanticToken = tokens[0];
            encodeSemanticTokens(tokens);

            expect(tokens[0]).to.equal(originalFirst);
        });
    });
});
