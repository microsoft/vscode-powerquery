// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import { expectScope, findToken, hasScope, TokenInfo, tokenizeLine } from "./grammarTestHelper.js";

describe("Grammar - Identifiers", () => {
    describe("regular identifiers", () => {
        it("should tokenize a simple identifier", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("myVariable");
            const token: TokenInfo | undefined = findToken(tokens, "myVariable");
            expect(token).to.not.equal(undefined);
            expectScope(token, "entity.name.powerquery");
        });

        it("should tokenize an identifier starting with underscore", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("_private");
            const token: TokenInfo | undefined = findToken(tokens, "_private");
            expect(token).to.not.equal(undefined);
            expectScope(token, "entity.name.powerquery");
        });

        it("should tokenize identifiers with digits", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("value1");
            const token: TokenInfo | undefined = findToken(tokens, "value1");
            expect(token).to.not.equal(undefined);
            expectScope(token, "entity.name.powerquery");
        });

        it("should tokenize single-character identifiers", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x = 1");
            const token: TokenInfo | undefined = findToken(tokens, "x");
            expect(token).to.not.equal(undefined);
            expectScope(token, "entity.name.powerquery");
        });
    });

    describe("dotted identifiers (M spec: regular-identifier with dot-character)", () => {
        // Per M spec: regular-identifier = available-identifier | available-identifier dot-character regular-identifier
        // "Table.AddColumn" is a single identifier — the dot is part of the identifier, NOT a member access

        it("should tokenize 'Table.AddColumn' as a single identifier", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("Table.AddColumn");
            const token: TokenInfo | undefined = findToken(tokens, "Table.AddColumn");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });

        it("should tokenize 'List.Transform' as a single identifier", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("List.Transform");
            const token: TokenInfo | undefined = findToken(tokens, "List.Transform");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });

        it("should tokenize short dotted identifiers like 'A.BC'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("A.BC");
            const token: TokenInfo | undefined = findToken(tokens, "A.BC");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });

        it("should tokenize multi-dot identifiers like 'A.B.C'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("A.B.C");
            const token: TokenInfo | undefined = findToken(tokens, "A.B.C");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });

        it("should not treat the dot as an operator in dotted identifiers", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("Table.AddColumn");
            const dotToken: TokenInfo | undefined = findToken(tokens, ".");

            if (dotToken) {
                expect.fail("Dot should not be a separate token in 'Table.AddColumn'");
            }
        });

        it("should tokenize dotted identifier in a function call", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("Table.AddColumn(tbl, col)");
            const token: TokenInfo | undefined = findToken(tokens, "Table.AddColumn");
            expect(token).to.not.equal(undefined);
            expectScope(token!, "entity.name.powerquery");
        });
    });

    describe("quoted identifiers", () => {
        it("should tokenize a quoted identifier with spaces", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('#"My Column Name"');

            // The #" and ending " are delimiters, the content may be one or more tokens
            const beginToken: TokenInfo | undefined = tokens.find(
                (t: TokenInfo) => t.text === '#"' && hasScope(t, "punctuation.definition.quotedidentifier.begin"),
            );

            expect(beginToken).to.not.equal(undefined);
        });

        it("should tokenize a quoted identifier with keywords inside", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('#"let in"');

            const beginToken: TokenInfo | undefined = tokens.find(
                (t: TokenInfo) => t.text === '#"' && hasScope(t, "punctuation.definition.quotedidentifier.begin"),
            );

            expect(beginToken).to.not.equal(undefined);
        });

        it("should tokenize a quoted identifier with escaped quotes", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('#"say ""hello"""');

            const escapeToken: TokenInfo | undefined = tokens.find(
                (t: TokenInfo) => t.text === '""' && hasScope(t, "constant.character.escape.quote"),
            );

            expect(escapeToken).to.not.equal(undefined);
        });

        it("should scope the whole quoted identifier as entity.name", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('#"Column A"');

            const entityTokens: TokenInfo[] = tokens.filter((t: TokenInfo) => hasScope(t, "entity.name.powerquery"));

            expect(entityTokens.length).to.be.greaterThan(0);
        });

        it("should tokenize a quoted identifier with operators inside", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('#"A + B"');

            const beginToken: TokenInfo | undefined = tokens.find(
                (t: TokenInfo) => t.text === '#"' && hasScope(t, "punctuation.definition.quotedidentifier.begin"),
            );

            expect(beginToken).to.not.equal(undefined);
        });
    });

    describe("inclusive identifiers (@)", () => {
        // Per M spec: inclusive-identifier-reference = @ identifier
        it("should tokenize '@myFunc' with @ as inclusive identifier marker", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("@myFunc");

            // The grammar should recognize @ as part of the identifier
            const hasInclusiveScope: boolean = tokens.some(
                (t: TokenInfo) =>
                    hasScope(t, "inclusiveidentifier") || hasScope(t, "keyword.operator.inclusiveidentifier"),
            );

            expect(hasInclusiveScope, "@ should be scoped as inclusive identifier").to.equal(true);
        });

        it("should tokenize the identifier part after @", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("@myFunc");

            const identToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "entity.name.powerquery"),
            );

            expect(identToken).to.not.equal(undefined);
        });
    });

    describe("implicit variable (_)", () => {
        it("should tokenize standalone '_' as implicit variable", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("each _ + 1");
            const token: TokenInfo | undefined = findToken(tokens, "_");
            expect(token).to.not.equal(undefined);
            expectScope(token, "keyword.operator.implicitvariable.powerquery");
        });

        it("should not treat '_' inside an identifier as implicit variable", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("my_var");
            const token: TokenInfo | undefined = findToken(tokens, "my_var");
            expect(token).to.not.equal(undefined);
            expectScope(token, "entity.name.powerquery");
        });
    });

    describe("intrinsic variables", () => {
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
    });
});
