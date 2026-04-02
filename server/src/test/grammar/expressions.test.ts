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

describe("Grammar - Expressions", () => {
    describe("let expression", () => {
        it("should tokenize a let/in expression", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("let x = 1 in x");
            const letToken: TokenInfo | undefined = findToken(tokens, "let");
            const inToken: TokenInfo | undefined = findToken(tokens, "in");

            expect(letToken).to.not.equal(undefined);
            expect(inToken).to.not.equal(undefined);
            expectScope(letToken, "keyword.other.powerquery");
            expectScope(inToken, "keyword.other.powerquery");
        });

        it("should tokenize a multiline let expression", async () => {
            const tokens: MultiLineTokenInfo[] = await tokenizeLines("let\n    x = 1,\n    y = 2\nin\n    x + y");

            const letToken: MultiLineTokenInfo | undefined = tokens.find((t: MultiLineTokenInfo) => t.text === "let");

            const inToken: MultiLineTokenInfo | undefined = tokens.find((t: MultiLineTokenInfo) => t.text === "in");

            expect(letToken).to.not.equal(undefined);
            expect(inToken).to.not.equal(undefined);
        });
    });

    describe("if expression", () => {
        it("should tokenize if/then/else", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("if x > 0 then x else -x");
            const ifToken: TokenInfo | undefined = findToken(tokens, "if");
            const thenToken: TokenInfo | undefined = findToken(tokens, "then");
            const elseToken: TokenInfo | undefined = findToken(tokens, "else");

            expect(ifToken).to.not.equal(undefined);
            expect(thenToken).to.not.equal(undefined);
            expect(elseToken).to.not.equal(undefined);
            expectScope(ifToken, "keyword.control.conditional.powerquery");
            expectScope(thenToken, "keyword.control.conditional.powerquery");
            expectScope(elseToken, "keyword.control.conditional.powerquery");
        });
    });

    describe("each expression", () => {
        it("should tokenize 'each _ + 1'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("each _ + 1");
            const eachToken: TokenInfo | undefined = findToken(tokens, "each");
            const underscoreToken: TokenInfo | undefined = findToken(tokens, "_");

            expect(eachToken).to.not.equal(undefined);
            expect(underscoreToken).to.not.equal(undefined);
            expectScope(eachToken, "keyword.other.powerquery");
            expectScope(underscoreToken, "keyword.operator.implicitvariable.powerquery");
        });

        it("should tokenize each with field access", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("each [Name]");
            const eachToken: TokenInfo | undefined = findToken(tokens, "each");
            expect(eachToken).to.not.equal(undefined);
            expectScope(eachToken, "keyword.other.powerquery");
        });
    });

    describe("function expression", () => {
        it("should tokenize a function definition", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("(x, y) => x + y");
            const arrowToken: TokenInfo | undefined = findToken(tokens, "=>");
            expect(arrowToken).to.not.equal(undefined);
            expectScope(arrowToken, "keyword.operator.function.powerquery");
        });

        it("should tokenize a typed function", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("(x as number) as number => x * 2");

            const asTokens: TokenInfo[] = tokens.filter(
                (t: TokenInfo) => t.text === "as" && hasScope(t, "keyword.other.powerquery"),
            );

            expect(asTokens.length).to.equal(2);
        });
    });

    describe("try/catch expression", () => {
        it("should tokenize try/otherwise", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("try x otherwise 0");
            const tryToken: TokenInfo | undefined = findToken(tokens, "try");
            const otherwiseToken: TokenInfo | undefined = findToken(tokens, "otherwise");

            expect(tryToken).to.not.equal(undefined);
            expect(otherwiseToken).to.not.equal(undefined);
            expectScope(tryToken, "keyword.control.exception.powerquery");
            expectScope(otherwiseToken, "keyword.control.exception.powerquery");
        });

        it("should tokenize try/catch", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("try x catch (e) => e");
            const tryToken: TokenInfo | undefined = findToken(tokens, "try");
            const catchToken: TokenInfo | undefined = findToken(tokens, "catch");

            expect(tryToken).to.not.equal(undefined);
            expect(catchToken).to.not.equal(undefined);
            expectScope(tryToken, "keyword.control.exception.powerquery");
            expectScope(catchToken, "keyword.control.exception.powerquery");
        });
    });

    describe("error expression", () => {
        it("should tokenize 'error' keyword", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('error "Something failed"');
            const errorToken: TokenInfo | undefined = findToken(tokens, "error");
            expect(errorToken).to.not.equal(undefined);
            expectScope(errorToken, "keyword.other.powerquery");
        });
    });

    describe("meta expression", () => {
        it("should tokenize 'meta' keyword", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('x meta [Documentation.Name = "Test"]');
            const metaToken: TokenInfo | undefined = findToken(tokens, "meta");
            expect(metaToken).to.not.equal(undefined);
            expectScope(metaToken, "keyword.other.powerquery");
        });
    });

    describe("list expression", () => {
        it("should tokenize a list literal", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("{1, 2, 3}");
            const openBrace: TokenInfo | undefined = findToken(tokens, "{");
            const closeBrace: TokenInfo | undefined = findToken(tokens, "}");
            expect(openBrace).to.not.equal(undefined);
            expect(closeBrace).to.not.equal(undefined);
            expectScope(openBrace, "punctuation.section.braces.begin.powerquery");
            expectScope(closeBrace, "punctuation.section.braces.end.powerquery");
        });

        it("should tokenize a list range with '..'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("{1..10}");
            const rangeToken: TokenInfo | undefined = findToken(tokens, "..");
            expect(rangeToken).to.not.equal(undefined);
            expectScope(rangeToken, "keyword.operator.list.powerquery");
        });
    });

    describe("record expression", () => {
        it("should tokenize a record literal", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('[Name = "Alice", Age = 30]');
            const openBracket: TokenInfo | undefined = findToken(tokens, "[");
            const closeBracket: TokenInfo | undefined = findToken(tokens, "]");
            expect(openBracket).to.not.equal(undefined);
            expect(closeBracket).to.not.equal(undefined);
        });

        it("should scope record content as meta.recordexpression", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("[a = 1]");

            const innerTokens: TokenInfo[] = tokens.filter((t: TokenInfo) =>
                hasScope(t, "meta.recordexpression.powerquery"),
            );

            expect(innerTokens.length).to.be.greaterThan(0);
        });
    });

    describe("section expression", () => {
        it("should tokenize a section declaration", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("section MySection;");
            const sectionToken: TokenInfo | undefined = findToken(tokens, "section");
            expect(sectionToken).to.not.equal(undefined);
            expectScope(sectionToken, "keyword.powerquery");
        });

        it("should tokenize shared section member", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("shared MyFunc = (x) => x;");
            const sharedToken: TokenInfo | undefined = findToken(tokens, "shared");
            expect(sharedToken).to.not.equal(undefined);
            expectScope(sharedToken, "keyword.powerquery");
        });

        it("should tokenize section access with '!'", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("Section1!Member1");
            const bangToken: TokenInfo | undefined = findToken(tokens, "!");
            expect(bangToken).to.not.equal(undefined);
            expectScope(bangToken, "keyword.operator.sectionaccess.powerquery");
        });
    });

    describe("real-world expressions", () => {
        it("should tokenize a Table.AddColumn call", async () => {
            const tokens: TokenInfo[] = await tokenizeLine('Table.AddColumn(Source, "NewCol", each [Value] * 2)');

            const funcName: TokenInfo | undefined = findToken(tokens, "Table.AddColumn");
            expect(funcName).to.not.equal(undefined);
            expectScope(funcName!, "entity.name.powerquery");
        });

        it("should tokenize a complex let expression", async () => {
            const tokens: MultiLineTokenInfo[] = await tokenizeLines(
                [
                    "let",
                    '    Source = Csv.Document(File.Contents("data.csv")),',
                    '    #"Promoted Headers" = Table.PromoteHeaders(Source),',
                    '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers", {{"Col1", type text}})',
                    "in",
                    '    #"Changed Type"',
                ].join("\n"),
            );

            // Verify key tokens
            const letToken: MultiLineTokenInfo | undefined = tokens.find((t: MultiLineTokenInfo) => t.text === "let");

            const inToken: MultiLineTokenInfo | undefined = tokens.find((t: MultiLineTokenInfo) => t.text === "in");

            expect(letToken).to.not.equal(undefined);
            expect(inToken).to.not.equal(undefined);

            // Verify dotted identifiers are matched as single tokens
            const csvDoc: MultiLineTokenInfo | undefined = tokens.find(
                (t: MultiLineTokenInfo) => t.text === "Csv.Document",
            );

            expect(csvDoc).to.not.equal(undefined);

            // Verify quoted identifiers
            const quotedIdBegins: MultiLineTokenInfo[] = tokens.filter(
                (t: MultiLineTokenInfo) =>
                    t.text === '#"' && hasScope(t, "punctuation.definition.quotedidentifier.begin"),
            );

            expect(quotedIdBegins.length).to.be.greaterThan(0);
        });

        it("should tokenize a type definition", async () => {
            const tokens: TokenInfo[] = await tokenizeLine("type table [Name = text, Age = number, Active = logical]");

            const typeToken: TokenInfo | undefined = findToken(tokens, "type");
            const tableToken: TokenInfo | undefined = findToken(tokens, "table");
            expect(typeToken).to.not.equal(undefined);
            expect(tableToken).to.not.equal(undefined);
        });

        it("should tokenize nested function with types", async () => {
            const tokens: TokenInfo[] = await tokenizeLine(
                "let fn = (x as number, optional y as nullable number) as number => x + (y ?? 0) in fn",
            );

            const letToken: TokenInfo | undefined = findToken(tokens, "let");
            const inToken: TokenInfo | undefined = findToken(tokens, "in");
            const arrowToken: TokenInfo | undefined = findToken(tokens, "=>");

            expect(letToken).to.not.equal(undefined);
            expect(inToken).to.not.equal(undefined);
            expect(arrowToken).to.not.equal(undefined);
        });
    });
});
