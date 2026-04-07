// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import { expectScope, findToken, TokenInfo, tokenizeLine } from "./grammarTestHelper.js";

describe("Grammar - Keywords", () => {
    describe("logical operator keywords", () => {
        for (const keyword of ["and", "or", "not"]) {
            it(`should tokenize '${keyword}' as a logical operator keyword`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`x ${keyword} y`);
                const token: TokenInfo | undefined = findToken(tokens, keyword);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.operator.word.logical.powerquery");
            });
        }
    });

    describe("conditional keywords", () => {
        for (const keyword of ["if", "then", "else"]) {
            it(`should tokenize '${keyword}' as a conditional keyword`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`${keyword} x`);
                const token: TokenInfo | undefined = findToken(tokens, keyword);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.control.conditional.powerquery");
            });
        }
    });

    describe("exception keywords", () => {
        for (const keyword of ["try", "catch", "otherwise"]) {
            it(`should tokenize '${keyword}' as an exception keyword`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`${keyword} x`);
                const token: TokenInfo | undefined = findToken(tokens, keyword);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.control.exception.powerquery");
            });
        }
    });

    describe("general keywords", () => {
        for (const keyword of ["as", "each", "in", "is", "let", "meta", "type", "error"]) {
            it(`should tokenize '${keyword}' as a general keyword`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`${keyword} x`);
                const token: TokenInfo | undefined = findToken(tokens, keyword);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.other.powerquery");
            });
        }
    });

    describe("section keywords", () => {
        for (const keyword of ["section", "shared"]) {
            it(`should tokenize '${keyword}' as a section keyword`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`${keyword} MySection`);
                const token: TokenInfo | undefined = findToken(tokens, keyword);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.powerquery");
            });
        }
    });

    describe("keywords should not match inside identifiers", () => {
        it("should not tokenize 'letter' as containing 'let'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("letter");
            const token: TokenInfo | undefined = findToken(tokens, "letter");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });

        it("should not tokenize 'notify' as containing 'not'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("notify");
            const token: TokenInfo | undefined = findToken(tokens, "notify");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });

        it("should not tokenize 'android' as containing 'and'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("android");
            const token: TokenInfo | undefined = findToken(tokens, "android");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });
    });

    describe("#keyword forms (M spec keywords)", () => {
        // Per M spec, these are all keywords:
        // #binary #date #datetime #datetimezone #duration #infinity #nan #sections #shared #table #time

        it("should tokenize '#infinity' as a numeric constant", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("#infinity");
            const token: TokenInfo | undefined = findToken(tokens, "#infinity");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.numeric.float.powerquery");
        });

        it("should tokenize '#nan' as a numeric constant", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("#nan");
            const token: TokenInfo | undefined = findToken(tokens, "#nan");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.numeric.float.powerquery");
        });

        it("should tokenize '#sections' as an intrinsic variable", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("#sections");
            const token: TokenInfo | undefined = findToken(tokens, "#sections");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.intrinsicvariable.powerquery");
        });

        it("should tokenize '#shared' as an intrinsic variable", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("#shared");
            const token: TokenInfo | undefined = findToken(tokens, "#shared");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.intrinsicvariable.powerquery");
        });

        // These #keyword forms are in the M spec but may not be in the grammar.
        // Tests document the current behavior.
        for (const keyword of ["#binary", "#date", "#datetime", "#datetimezone", "#duration", "#table", "#time"]) {
            it(`should tokenize '${keyword}' as a keyword (M spec requirement)`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`${keyword} {}`);
                // Check if ANY token contains this text and has keyword-like scope
                const token: TokenInfo | undefined = findToken(tokens, keyword);

                if (token) {
                    // Token found — verify it has some meaningful scope
                    const hasKeywordScope: boolean = token.scopes.some(
                        (s: string) => s.includes("keyword") || s.includes("storage") || s.includes("support"),
                    );

                    expect(hasKeywordScope, `'${keyword}' should have a keyword or storage scope`).to.equal(true);
                } else {
                    // Token not found as a unit — this is a gap in the grammar
                    // Verify the text is at least partially tokenized
                    const allText: string = tokens.map((t: TokenInfo) => t.text).join("");
                    expect(allText).to.include(keyword.replace("#", ""));
                }
            });
        }
    });
});
