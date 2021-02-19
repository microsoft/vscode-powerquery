// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { Hover, Position, SignatureHelp } from "@microsoft/powerquery-language-services";
import { Assert } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { MarkupContent, ParameterInformation, SignatureInformation } from "vscode-languageserver";

import { StandardLibrary } from "../library";

function assertGetHover(text: string): Promise<Hover> {
    return createAnalysis(text).getHover();
}

function assertGetSignatureHelp(text: string): Promise<SignatureHelp> {
    return createAnalysis(text).getSignatureHelp();
}

async function assertHoverContentEquals(text: string, expected: string): Promise<void> {
    const hover: Hover = await assertGetHover(text);
    const markupContent: MarkupContent = assertAsMarkupContent(hover.contents);
    expect(markupContent.value).to.equal(expected);
}

function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);
    return value;
}

function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

function createAnalysis(textWithPipe: string): PQLS.Analysis {
    const text: string = textWithPipe.replace("|", "");
    const position: Position = {
        character: textWithPipe.indexOf("|"),
        line: 0,
    };

    return PQLS.AnalysisUtils.createAnalysis(PQLS.createTextDocument("id", 1, text), position, StandardLibrary);
}

describe(`StandardLibrary`, () => {
    describe(`getHover`, () => {
        it(`Table.AddColumn`, async () => {
            const expression: string = `let foo = Table.AddColumn(1 as table, "bar", each 1) in fo|o`;
            const expected: string = "[let-variable] foo: table [bar: 1, ...]";
            await assertHoverContentEquals(expression, expected);
        });
    });

    it("getSignatureHelp", async () => {
        const signatureHelp: SignatureHelp = await assertGetSignatureHelp("Table.AddColumn(|");
        expect(signatureHelp.activeParameter).to.equal(0);
        expect(signatureHelp.activeSignature).to.equal(0);
        expect(signatureHelp.signatures.length).to.equal(2);

        const signature: SignatureInformation = PQP.Assert.asDefined(signatureHelp.signatures[0]);
        Assert.isDefined(signature.documentation);
        expect(signature.documentation).to.equal(
            `Adds a column with the specified name. The value is computed using the specified selection function with each row taken as an input.`,
        );

        Assert.isDefined(signature.parameters);
        expect(signature.parameters.length).to.equal(3);
        const parameters: ReadonlyArray<ParameterInformation> = signature.parameters;

        const firstParameter: ParameterInformation = PQP.Assert.asDefined(parameters[0]);
        expect(firstParameter.label).to.equal(PQP.Language.Constant.PrimitiveTypeConstantKind.Table);

        const secondParameter: ParameterInformation = PQP.Assert.asDefined(parameters[1]);
        expect(secondParameter.label).to.equal("newColumnName");

        const thirdParameter: ParameterInformation = PQP.Assert.asDefined(parameters[2]);
        expect(thirdParameter.label).to.equal("columnGenerator");
    });
});
