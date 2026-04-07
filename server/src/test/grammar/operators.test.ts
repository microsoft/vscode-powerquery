// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import { expectScope, findToken, hasScope, TokenInfo, tokenizeLine } from "./grammarTestHelper.js";

describe("Grammar - Operators", () => {
    describe("assignment/comparison operator", () => {
        it("should tokenize '=' as assignment-or-comparison", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x = 1");
            const token: TokenInfo | undefined = findToken(tokens, "=");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.assignment-or-comparison.powerquery");
        });
    });

    describe("comparison operators", () => {
        for (const op of ["<>", "<", ">", "<=", ">="]) {
            it(`should tokenize '${op}' as a comparison operator`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`x ${op} y`);
                const token: TokenInfo | undefined = findToken(tokens, op);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.operator.comparison.powerquery");
            });
        }
    });

    describe("arithmetic operators", () => {
        for (const op of ["+", "-", "*", "/"]) {
            it(`should tokenize '${op}' as an arithmetic operator`, async () => {
                const tokens: TokenInfo[] = await tokenizeLine(`x ${op} y`);
                const token: TokenInfo | undefined = findToken(tokens, op);
                expect(token).to.not.equal(undefined);
                expectScope(token, "keyword.operator.arithmetic.powerquery");
            });
        }
    });

    describe("combination operator", () => {
        it("should tokenize '&' as a combination operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"a" & "b"');
            const token: TokenInfo | undefined = findToken(tokens, "&");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.combination.powerquery");
        });
    });

    describe("function operator", () => {
        it("should tokenize '=>' as a function operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("(x) => x + 1");
            const token: TokenInfo | undefined = findToken(tokens, "=>");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.function.powerquery");
        });
    });

    describe("section access operator", () => {
        it("should tokenize '!' as section access operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("Section1!Value1");
            const token: TokenInfo | undefined = findToken(tokens, "!");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.sectionaccess.powerquery");
        });
    });

    describe("optional operator", () => {
        it("should tokenize '?' as optional operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("record[field]?");
            const token: TokenInfo | undefined = findToken(tokens, "?");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.optional.powerquery");
        });
    });

    describe("null coalescing operator (M spec: ??)", () => {
        it("should tokenize '??' as a null coalescing operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x ?? 0");
            const token: TokenInfo | undefined = findToken(tokens, "??");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "keyword.operator.nullcoalescing.powerquery");
        });
    });

    describe("dot operators", () => {
        it("should tokenize '..' as list operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("{1..10}");
            const token: TokenInfo | undefined = findToken(tokens, "..");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.list.powerquery");
        });

        it("should tokenize '...' as ellipsis operator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("...");
            const token: TokenInfo | undefined = findToken(tokens, "...");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.ellipsis.powerquery");
        });

        it("should not confuse '...' with '..'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("...");
            // "..." should be matched as ellipsis, not as ".." followed by "."
            const ellipsisToken: TokenInfo | undefined = findToken(tokens, "...");
            expect(ellipsisToken).to.not.equal(undefined);
        });
    });

    describe("punctuators", () => {
        it("should tokenize ',' as separator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("a, b");
            const token: TokenInfo | undefined = findToken(tokens, ",");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.separator.powerquery");
        });

        it("should tokenize '(' as begin parens", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("(x)");
            const token: TokenInfo | undefined = findToken(tokens, "(");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.section.parens.begin.powerquery");
        });

        it("should tokenize ')' as end parens", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("(x)");
            const token: TokenInfo | undefined = findToken(tokens, ")");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.section.parens.end.powerquery");
        });

        it("should tokenize '{' as begin braces", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("{1, 2}");
            const token: TokenInfo | undefined = findToken(tokens, "{");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.section.braces.begin.powerquery");
        });

        it("should tokenize '}' as end braces", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("{1, 2}");
            const token: TokenInfo | undefined = findToken(tokens, "}");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.section.braces.end.powerquery");
        });

        it("should tokenize '[' as begin brackets (record)", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("[a = 1]");
            const token: TokenInfo | undefined = findToken(tokens, "[");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.section.brackets.begin.powerquery");
        });

        it("should tokenize ']' as end brackets (record)", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("[a = 1]");
            const token: TokenInfo | undefined = findToken(tokens, "]");
            expect(token).to.not.equal(undefined);
            expectScope(token, "punctuation.section.brackets.end.powerquery");
        });

        it("should tokenize ';' as a terminator", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("section MySection;");
            const token: TokenInfo | undefined = findToken(tokens, ";");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "punctuation.terminator.powerquery");
        });
    });

    describe("record expression scoping", () => {
        it("should scope record contents as meta.recordexpression", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("[a = 1, b = 2]");

            const recordTokens: TokenInfo[] = tokens.filter((t: TokenInfo) =>
                hasScope(t, "meta.recordexpression.powerquery"),
            );

            expect(recordTokens.length).to.be.greaterThan(0);
        });

        it("should handle nested records", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("[a = [b = 1]]");

            // Inner content should have nested recordexpression scope
            const innerTokens: TokenInfo[] = tokens.filter(
                (t: TokenInfo) =>
                    t.scopes.filter((s: string) => s.includes("meta.recordexpression.powerquery")).length >= 2,
            );

            expect(innerTokens.length, "inner record content should have nested record scopes").to.be.greaterThan(0);
        });
    });
});
