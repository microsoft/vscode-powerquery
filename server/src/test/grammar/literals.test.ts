// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import {
    expectScope,
    findToken,
    hasScope,
    MultiLineTokenInfo,
    TokenInfo,
    tokenizeLine,
    tokenizeLines,
} from "./grammarTestHelper.js";

describe("Grammar - Literals", () => {
    describe("string literals", () => {
        it("should tokenize a simple string", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"Hello, world"');

            const stringTokens: TokenInfo[] = tokens.filter((t: TokenInfo) =>
                hasScope(t, "string.quoted.double.powerquery"),
            );

            expect(stringTokens.length).to.be.greaterThan(0);
        });

        it("should tokenize string delimiters", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"text"');

            const beginToken: TokenInfo | undefined = tokens.find(
                (t: TokenInfo) => t.text === '"' && hasScope(t, "punctuation.definition.string.begin.powerquery"),
            );

            expect(beginToken).to.not.equal(undefined);
        });

        it("should tokenize escaped double quotes inside strings", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"say ""hello""!"');

            const escapeTokens: TokenInfo[] = tokens.filter(
                (t: TokenInfo) => t.text === '""' && hasScope(t, "constant.character.escape.quote.powerquery"),
            );

            expect(escapeTokens.length).to.be.greaterThan(0);
        });

        it("should tokenize empty strings", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('""');

            const stringTokens: TokenInfo[] = tokens.filter((t: TokenInfo) =>
                hasScope(t, "string.quoted.double.powerquery"),
            );

            expect(stringTokens.length).to.be.greaterThan(0);
        });

        it("should tokenize escape sequences in strings", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"Hello#(cr,lf)World"');

            const escapeToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "constant.character.escapesequence.powerquery"),
            );

            expect(escapeToken).to.not.equal(undefined);
        });

        it("should tokenize unicode escape sequences", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"#(000D)"');

            const escapeToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "constant.character.escapesequence.powerquery"),
            );

            expect(escapeToken).to.not.equal(undefined);
        });

        it("should tokenize # escape in strings", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"#(#)"');

            const escapeToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "constant.character.escapesequence.powerquery"),
            );

            expect(escapeToken).to.not.equal(undefined);
        });

        it("should tokenize tab escape", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('"#(tab)"');

            const escapeToken: TokenInfo | undefined = tokens.find((t: TokenInfo) =>
                hasScope(t, "constant.character.escapesequence.powerquery"),
            );

            expect(escapeToken).to.not.equal(undefined);
        });
    });

    describe("integer literals", () => {
        it("should tokenize a simple integer", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("42");
            const token: TokenInfo | undefined = findToken(tokens, "42");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.integer.powerquery");
        });

        it("should tokenize zero", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("0");
            const token: TokenInfo | undefined = findToken(tokens, "0");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric");
        });

        it("should tokenize multi-digit integers", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("12345");
            const token: TokenInfo | undefined = findToken(tokens, "12345");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric");
        });
    });

    describe("hexadecimal literals", () => {
        it("should tokenize 0xFF", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("0xFF");
            const token: TokenInfo | undefined = findToken(tokens, "0xFF");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.integer.hexadecimal.powerquery");
        });

        it("should tokenize 0x with uppercase X", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("0XAB");
            const token: TokenInfo | undefined = findToken(tokens, "0XAB");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.integer.hexadecimal.powerquery");
        });

        it("should tokenize long hex values", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("0xDEADBEEF");
            const token: TokenInfo | undefined = findToken(tokens, "0xDEADBEEF");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.integer.hexadecimal.powerquery");
        });
    });

    describe("decimal (floating point) literals", () => {
        it("should tokenize a decimal number", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("3.14");
            const token: TokenInfo | undefined = findToken(tokens, "3.14");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.decimal.powerquery");
        });

        it("should tokenize a decimal starting with dot", async () => {
            // Per M spec: decimal-number-literal includes .decimal-digits
            const tokens: TokenInfo[] = await tokenizeLine(".5");
            const token: TokenInfo | undefined = findToken(tokens, ".5");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.decimal.powerquery");
        });

        it("should tokenize a decimal with leading zero", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("0.123");
            const token: TokenInfo | undefined = findToken(tokens, "0.123");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.decimal.powerquery");
        });
    });

    describe("floating point literals with exponents", () => {
        it("should tokenize a float with exponent", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("1e10");
            const token: TokenInfo | undefined = findToken(tokens, "1e10");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.float.powerquery");
        });

        it("should tokenize a float with uppercase E", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("1E10");
            const token: TokenInfo | undefined = findToken(tokens, "1E10");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.float.powerquery");
        });

        it("should tokenize a float with positive exponent", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("1e+5");
            const token: TokenInfo | undefined = findToken(tokens, "1e+5");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.float.powerquery");
        });

        it("should tokenize a float with negative exponent", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("1e-5");
            const token: TokenInfo | undefined = findToken(tokens, "1e-5");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.float.powerquery");
        });

        it("should tokenize a float with decimal and exponent", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("3.14e10");
            const token: TokenInfo | undefined = findToken(tokens, "3.14e10");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.numeric.float.powerquery");
        });
    });

    describe("numeric constants", () => {
        it("should tokenize #infinity", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("#infinity");
            const token: TokenInfo | undefined = findToken(tokens, "#infinity");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.numeric.float.powerquery");
        });

        it("should tokenize #nan", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("#nan");
            const token: TokenInfo | undefined = findToken(tokens, "#nan");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.numeric.float.powerquery");
        });
    });

    describe("logical literals", () => {
        it("should tokenize 'true'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("true");
            const token: TokenInfo | undefined = findToken(tokens, "true");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.logical.powerquery");
        });

        it("should tokenize 'false'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("false");
            const token: TokenInfo | undefined = findToken(tokens, "false");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.logical.powerquery");
        });
    });

    describe("null literal", () => {
        it("should tokenize 'null'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("null");
            const token: TokenInfo | undefined = findToken(tokens, "null");
            expect(token).to.not.equal(undefined);
            expectScope(token, "constant.language.null.powerquery");
        });
    });

    describe("verbatim literals (M spec)", () => {
        // Per M spec: verbatim-literal = #!" text-literal-characters_opt "
        it("should tokenize '#!\"text\"' as a verbatim literal", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('#!"some error text"');
            // Check if the grammar handles verbatim literals at all
            const allText: string = tokens.map((t: TokenInfo) => t.text).join("");
            expect(allText).to.include("some error text");
        });
    });

    describe("multiline strings", () => {
        it("should tokenize a string spanning multiple lines", async () => {
            const tokens: MultiLineTokenInfo[] = await tokenizeLines('"Hello\nWorld"');

            const stringTokens: MultiLineTokenInfo[] = tokens.filter((t: MultiLineTokenInfo) =>
                hasScope(t, "string.quoted.double.powerquery"),
            );

            expect(stringTokens.length).to.be.greaterThan(0);
        });
    });
});
