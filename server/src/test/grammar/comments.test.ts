// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import {
    findToken,
    hasScope,
    MultiLineTokenInfo,
    TokenInfo,
    tokenizeLine,
    tokenizeLines,
} from "./grammarTestHelper.js";

describe("Grammar - Comments", () => {
    describe("single-line comments", () => {
        it("should tokenize a single-line comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("// This is a comment");

            const commentToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "comment.line.double-slash.powerquery"),
            );

            expect(commentToken).to.not.equal(undefined);
        });

        it("should tokenize a comment after code", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x = 1 // inline comment");

            const commentToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "comment.line.double-slash.powerquery"),
            );

            expect(commentToken).to.not.equal(undefined);

            // The code before the comment should not be in comment scope
            const xToken: TokenInfo | undefined = findToken(tokens, "x");
            expect(xToken).to.not.equal(undefined);
            expect(hasScope(xToken!, "comment")).to.equal(false);
        });

        it("should tokenize an empty comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("//");

            const commentToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "comment.line.double-slash.powerquery"),
            );

            expect(commentToken).to.not.equal(undefined);
        });

        it("should not treat // inside a string as a comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"http://example.com"');

            const commentTokens: TokenInfo[] = tokens.filter((t: TokenInfo) => hasScope(t, "comment"));

            expect(commentTokens.length, "// inside a string should not be a comment").to.equal(0);
        });
    });

    describe("block comments", () => {
        it("should tokenize a single-line block comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("/* block comment */");

            const commentToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "comment.block.powerquery"),
            );

            expect(commentToken).to.not.equal(undefined);
        });

        it("should tokenize a multi-line block comment", async () => {
            const tokens: MultiLineTokenInfo[] = await tokenizeLines("/* first line\nsecond line */");

            const commentTokens: MultiLineTokenInfo[] = tokens.filter((t: MultiLineTokenInfo) =>
                hasScope(t, "comment.block.powerquery"),
            );

            expect(commentTokens.length).to.be.greaterThan(0);

            // Both lines should have comment tokens
            const line0Comments: MultiLineTokenInfo[] = commentTokens.filter((t: MultiLineTokenInfo) => t.line === 0);

            const line1Comments: MultiLineTokenInfo[] = commentTokens.filter((t: MultiLineTokenInfo) => t.line === 1);

            expect(line0Comments.length).to.be.greaterThan(0);
            expect(line1Comments.length).to.be.greaterThan(0);
        });

        it("should tokenize code before and after block comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x /* comment */ y");
            const xToken: TokenInfo | undefined = findToken(tokens, "x");
            const yToken: TokenInfo | undefined = findToken(tokens, "y");

            expect(xToken).to.not.equal(undefined);
            expect(yToken).to.not.equal(undefined);
            expect(hasScope(xToken!, "comment")).to.equal(false);
            expect(hasScope(yToken!, "comment")).to.equal(false);
        });

        it("should not treat /* inside a string as a comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"/* not a comment */"');

            // All tokens should be within string scope, none should be comment
            const nonStringCommentTokens: TokenInfo[] = tokens.filter(
                (t: TokenInfo) => hasScope(t, "comment") && !hasScope(t, "string"),
            );

            expect(nonStringCommentTokens.length).to.equal(0);
        });

        it("should handle empty block comment", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("/**/");

            const commentToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "comment.block.powerquery"),
            );

            expect(commentToken).to.not.equal(undefined);
        });
    });
});
