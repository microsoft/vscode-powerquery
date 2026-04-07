// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import { expectScope, findToken, hasScope, TokenInfo, tokenizeLine } from "./grammarTestHelper.js";

describe("Grammar - Types", () => {
    describe("primitive types", () => {
        const primitiveTypes: string[] = [
            "action",
            "any",
            "anynonnull",
            "binary",
            "date",
            "datetime",
            "datetimezone",
            "duration",
            "function",
            "list",
            "logical",
            "none",
            "null",
            "number",
            "record",
            "table",
            "text",
            "time",
            "type",
        ];

        for (const typeName of primitiveTypes) {
            it(`should tokenize '${typeName}' as a storage type`, async () => {
                // Use in a type context to avoid keyword conflicts
                const tokens: TokenInfo[] = await tokenizeLine(`x as ${typeName}`);
                const token: TokenInfo | undefined = findToken(tokens, typeName);
                expect(token).to.not.equal(undefined);

                // Some of these ('null', 'type') might match keyword rules instead of type rules
                const hasTypeOrKeywordScope: boolean =
                    hasScope(token!, "storage.type.powerquery") ||
                    hasScope(token!, "constant.language.null.powerquery") ||
                    hasScope(token!, "keyword.other.powerquery");

                expect(
                    hasTypeOrKeywordScope,
                    `'${typeName}' should have a type or keyword scope, got: [${token!.scopes.join(", ")}]`,
                ).to.equal(true);
            });
        }
    });

    describe("type modifiers", () => {
        it("should tokenize 'optional' as a storage modifier", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("optional x as text");
            const token: TokenInfo | undefined = findToken(tokens, "optional");
            expect(token).to.not.equal(undefined);
            expectScope(token, "storage.modifier.powerquery");
        });

        it("should tokenize 'nullable' as a storage modifier", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x as nullable text");
            const token: TokenInfo | undefined = findToken(tokens, "nullable");
            expect(token).to.not.equal(undefined);
            expectScope(token, "storage.modifier.powerquery");
        });
    });

    describe("type in context", () => {
        it("should tokenize type assertion with 'as'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x as number");
            const asToken: TokenInfo | undefined = findToken(tokens, "as");
            const numberToken: TokenInfo | undefined = findToken(tokens, "number");
            expect(asToken).to.not.equal(undefined);
            expect(numberToken).to.not.equal(undefined);
            expectScope(asToken, "keyword.other.powerquery");
            expectScope(numberToken, "storage.type.powerquery");
        });

        it("should tokenize type check with 'is'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x is number");
            const isToken: TokenInfo | undefined = findToken(tokens, "is");
            const numberToken: TokenInfo | undefined = findToken(tokens, "number");
            expect(isToken).to.not.equal(undefined);
            expect(numberToken).to.not.equal(undefined);
            expectScope(isToken, "keyword.other.powerquery");
            expectScope(numberToken, "storage.type.powerquery");
        });

        it("should tokenize nullable type", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("x as nullable number");
            const nullableToken: TokenInfo | undefined = findToken(tokens, "nullable");
            const numberToken: TokenInfo | undefined = findToken(tokens, "number");
            expect(nullableToken).to.not.equal(undefined);
            expect(numberToken).to.not.equal(undefined);
            expectScope(nullableToken, "storage.modifier.powerquery");
            expectScope(numberToken, "storage.type.powerquery");
        });

        it("should tokenize optional parameter type", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("optional x as text");
            const optionalToken: TokenInfo | undefined = findToken(tokens, "optional");
            const textToken: TokenInfo | undefined = findToken(tokens, "text");
            expect(optionalToken).to.not.equal(undefined);
            expect(textToken).to.not.equal(undefined);
            expectScope(optionalToken, "storage.modifier.powerquery");
            expectScope(textToken, "storage.type.powerquery");
        });
    });
});
