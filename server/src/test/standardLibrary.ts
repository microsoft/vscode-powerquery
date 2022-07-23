// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { AnalysisSettings, Hover, Position, SignatureHelp } from "@microsoft/powerquery-language-services";
import { Assert, CommonError, Result } from "@microsoft/powerquery-parser";
import { MarkupContent, ParameterInformation, SignatureInformation } from "vscode-languageserver";
import { expect } from "chai";

import { CancellationTokenUtils } from "../cancellationToken";
import { LibraryUtils } from "../library";

const library: PQLS.Library.ILibrary = LibraryUtils.getOrCreateStandardLibrary(PQP.Locale.en_US);

function assertGetHover(text: string): Promise<Result<Hover | undefined, CommonError.CommonError>> {
    const [analysis, position]: [PQLS.Analysis, Position] = createAnalysis(text);

    return analysis.getHover(position);
}

function assertGetSignatureHelp(text: string): Promise<Result<SignatureHelp | undefined, CommonError.CommonError>> {
    const [analysis, position]: [PQLS.Analysis, Position] = createAnalysis(text);

    return analysis.getSignatureHelp(position);
}

async function assertHoverContentEquals(text: string, expected: string): Promise<void> {
    const hover: Result<Hover | undefined, CommonError.CommonError> = await assertGetHover(text);
    Assert.isOk(hover);
    Assert.isDefined(hover.value);

    const markupContent: MarkupContent = assertAsMarkupContent(hover.value.contents);
    expect(markupContent.value).to.equal(expected);
}

const assertIsFunction: (
    definition: PQLS.Library.TLibraryDefinition,
) => asserts definition is PQLS.Library.LibraryFunction = PQLS.LibraryUtils.assertIsFunction;

function assertAsMarkupContent(value: Hover["contents"]): MarkupContent {
    assertIsMarkupContent(value);

    return value;
}

function assertIsMarkupContent(value: Hover["contents"]): asserts value is MarkupContent {
    if (!MarkupContent.is(value)) {
        throw new Error(`expected value to be MarkupContent`);
    }
}

function createAnalysis(textWithPipe: string): [PQLS.Analysis, Position] {
    const text: string = textWithPipe.replace("|", "");

    const position: Position = {
        character: textWithPipe.indexOf("|"),
        line: 0,
    };

    const library: PQLS.Library.ILibrary = LibraryUtils.getOrCreateStandardLibrary();

    const analysisSettings: AnalysisSettings = {
        createCancellationTokenFn: (_action: string) => CancellationTokenUtils.createTimedCancellation(1000),
        inspectionSettings: PQLS.InspectionUtils.createInspectionSettings(PQP.DefaultSettings, { library }),
        isWorkspaceCacheAllowed: false,
        maybeInitialCorrelationId: undefined,
        traceManager: PQP.Trace.NoOpTraceManagerInstance,
    };

    return [
        PQLS.AnalysisUtils.createAnalysis(PQLS.createTextDocument(textWithPipe, 1, text), analysisSettings),
        position,
    ];
}

describe(`StandardLibrary`, () => {
    describe(`simple`, () => {
        it("index const by name", () => {
            const definitionKey: string = "BinaryOccurrence.Required";

            const maybeLibraryDefinition: PQLS.Library.TLibraryDefinition | undefined =
                library.libraryDefinitions.get(definitionKey);

            if (maybeLibraryDefinition === undefined) {
                throw new Error(`expected constant '${definitionKey}' was not found`);
            }

            const libraryDefinition: PQLS.Library.TLibraryDefinition = maybeLibraryDefinition;

            expect(libraryDefinition.label).eq(definitionKey, "unexpected label");
            expect(libraryDefinition.description.length).greaterThan(0, "summary should not be empty");
            expect(libraryDefinition.kind).eq(PQLS.Library.LibraryDefinitionKind.Constant);
            expect(libraryDefinition.asPowerQueryType.kind).eq(PQP.Language.Type.TypeKind.Number);
        });

        it("index function by name", () => {
            const exportKey: string = "List.Distinct";

            const maybeLibraryDefinition: PQLS.Library.TLibraryDefinition | undefined =
                library.libraryDefinitions.get(exportKey);

            if (maybeLibraryDefinition === undefined) {
                throw new Error(`expected constant '${exportKey}' was not found`);
            }

            const libraryDefinition: PQLS.Library.TLibraryDefinition = maybeLibraryDefinition;
            assertIsFunction(libraryDefinition);

            expect(libraryDefinition.label !== null);
            expect(libraryDefinition.parameters[0].typeKind).eq(PQP.Language.Type.TypeKind.List);
            expect(libraryDefinition.parameters[1].typeKind).eq(PQP.Language.Type.TypeKind.Any);
        });

        it("#date constructor", () => {
            const exportKey: string = "#date";

            const maybeLibraryDefinition: PQLS.Library.TLibraryDefinition | undefined =
                library.libraryDefinitions.get(exportKey);

            if (maybeLibraryDefinition === undefined) {
                throw new Error(`expected constant '${exportKey}' was not found`);
            }

            const libraryDefinition: PQLS.Library.TLibraryDefinition = maybeLibraryDefinition;
            assertIsFunction(libraryDefinition);

            expect(libraryDefinition.label !== null);
            expect(libraryDefinition.kind).eq(PQLS.Library.LibraryDefinitionKind.Function);
            expect(libraryDefinition.parameters.length).eq(3, "expecting 3 parameters in first signature");
            expect(libraryDefinition.parameters[0].label).eq("year");
            expect(libraryDefinition.parameters[0].typeKind).eq(PQP.Language.Type.TypeKind.Number);
        });
    });

    describe(`StandardLibrary `, () => {
        describe(`Table.AddColumn`, () => {
            it(`getHover`, async () => {
                const expression: string = `let foo = Table.AddColumn(1 as table, "bar", each 1) in fo|o`;
                const expected: string = "[let-variable] foo: table [bar: 1, ...]";
                await assertHoverContentEquals(expression, expected);
            });

            it("getSignatureHelp", async () => {
                const signatureHelp: Result<SignatureHelp | undefined, CommonError.CommonError> =
                    await assertGetSignatureHelp("Table.AddColumn(|");

                Assert.isOk(signatureHelp);
                Assert.isDefined(signatureHelp.value);

                expect(signatureHelp.value.activeParameter).to.equal(0);
                expect(signatureHelp.value.activeSignature).to.equal(0);
                expect(signatureHelp.value.signatures.length).to.equal(1);

                const signature: SignatureInformation = PQP.Assert.asDefined(signatureHelp.value.signatures[0]);
                Assert.isDefined(signature.documentation);

                expect(signature.documentation).to.equal(
                    `Adds a column with the specified name. The value is computed using the specified selection function with each row taken as an input.`,
                );

                Assert.isDefined(signature.parameters);
                expect(signature.parameters.length).to.equal(4);
                const parameters: ReadonlyArray<ParameterInformation> = signature.parameters;

                const firstParameter: ParameterInformation = PQP.Assert.asDefined(parameters[0]);
                expect(firstParameter.label).to.equal(PQP.Language.Constant.PrimitiveTypeConstant.Table);

                const secondParameter: ParameterInformation = PQP.Assert.asDefined(parameters[1]);
                expect(secondParameter.label).to.equal("newColumnName");

                const thirdParameter: ParameterInformation = PQP.Assert.asDefined(parameters[2]);
                expect(thirdParameter.label).to.equal("columnGenerator");

                const fourthParameter: ParameterInformation = PQP.Assert.asDefined(parameters[3]);
                expect(fourthParameter.label).to.equal("columnType");
            });
        });
    });
});
