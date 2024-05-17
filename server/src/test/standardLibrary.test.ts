// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// import "mocha";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { AnalysisSettings, Hover, Position, SignatureHelp } from "@microsoft/powerquery-language-services";
import { Assert, ResultUtils } from "@microsoft/powerquery-parser";
import { MarkupContent, ParameterInformation, SignatureInformation } from "vscode-languageserver";
import { expect } from "chai";

import { LibraryUtils, ModuleLibraries } from "../library";

const library: PQLS.Library.ILibrary = LibraryUtils.getOrCreateStandardLibrary(PQP.Locale.en_US);

class NoOpCancellationToken implements PQP.ICancellationToken {
    isCancelled: () => boolean = () => false;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    throwIfCancelled: () => void = () => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    cancel: () => void = () => {};
}

const NoOpCancellationTokenInstance: NoOpCancellationToken = new NoOpCancellationToken();

async function assertGetHover(text: string): Promise<Hover> {
    const [analysis, position]: [PQLS.Analysis, Position] = createAnalysis(text);

    const result: PQP.Result<PQLS.Hover | undefined, PQP.CommonError.CommonError> = await analysis.getHover(
        position,
        NoOpCancellationTokenInstance,
    );

    ResultUtils.assertIsOk(result);

    return (
        result.value ?? {
            range: undefined,
            contents: [],
        }
    );
}

async function assertGetSignatureHelp(text: string): Promise<SignatureHelp> {
    const [analysis, position]: [PQLS.Analysis, Position] = createAnalysis(text);

    const result: PQP.Result<SignatureHelp | undefined, PQP.CommonError.CommonError> = await analysis.getSignatureHelp(
        position,
        NoOpCancellationTokenInstance,
    );

    ResultUtils.assertIsOk(result);

    return (
        result.value ?? {
            signatures: [],
            activeSignature: undefined,
            activeParameter: undefined,
        }
    );
}

async function assertHoverContentEquals(text: string, expected: string): Promise<void> {
    const hover: Hover = await assertGetHover(text);
    const markupContent: MarkupContent = assertAsMarkupContent(hover.contents);
    expect(markupContent.value).to.equal(expected);
}

const assertIsFunction: (
    definition: PQLS.Library.TLibraryDefinition,
) => asserts definition is PQLS.Library.LibraryFunction = PQLS.LibraryDefinitionUtils.assertIsFunction;

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
        inspectionSettings: PQLS.InspectionUtils.inspectionSettings(PQP.DefaultSettings, { library }),
        isWorkspaceCacheAllowed: false,
        traceManager: PQP.Trace.NoOpTraceManagerInstance,
        initialCorrelationId: undefined,
    };

    return [PQLS.AnalysisUtils.analysis(PQLS.textDocument(textWithPipe, 1, text), analysisSettings), position];
}

describe(`StandardLibrary`, () => {
    describe(`simple`, () => {
        it("index const by name", () => {
            const definitionKey: string = "BinaryOccurrence.Required";

            const libraryDefinition: PQLS.Library.TLibraryDefinition | undefined =
                library.libraryDefinitions.staticLibraryDefinitions.get(definitionKey);

            if (libraryDefinition === undefined) {
                throw new Error(`expected constant '${definitionKey}' was not found`);
            }

            expect(libraryDefinition.label).eq(definitionKey, "unexpected label");
            expect(libraryDefinition.description.length).greaterThan(0, "summary should not be empty");
            expect(libraryDefinition.kind).eq(PQLS.Library.LibraryDefinitionKind.Constant);
            expect(libraryDefinition.asPowerQueryType.kind).eq(PQP.Language.Type.TypeKind.Number);
        });

        it("index function by name", () => {
            const exportKey: string = "List.Distinct";

            const libraryDefinition: PQLS.Library.TLibraryDefinition | undefined =
                library.libraryDefinitions.staticLibraryDefinitions.get(exportKey);

            if (libraryDefinition === undefined) {
                throw new Error(`expected constant '${exportKey}' was not found`);
            }

            assertIsFunction(libraryDefinition);

            expect(libraryDefinition.label !== null);
            expect(libraryDefinition.parameters[0].typeKind).eq(PQP.Language.Type.TypeKind.List);
            expect(libraryDefinition.parameters[1].typeKind).eq(PQP.Language.Type.TypeKind.Any);
        });

        it("#date constructor", () => {
            const exportKey: string = "#date";

            const libraryDefinition: PQLS.Library.TLibraryDefinition | undefined =
                library.libraryDefinitions.staticLibraryDefinitions.get(exportKey);

            if (libraryDefinition === undefined) {
                throw new Error(`expected constant '${exportKey}' was not found`);
            }

            assertIsFunction(libraryDefinition);

            expect(libraryDefinition.label !== null);
            expect(libraryDefinition.kind).eq(PQLS.Library.LibraryDefinitionKind.Function);
            expect(libraryDefinition.parameters.length).eq(3, "expecting 3 parameters in first signature");
            expect(libraryDefinition.parameters[0].label).eq("year");
            expect(libraryDefinition.parameters[0].typeKind).eq(PQP.Language.Type.TypeKind.Number);
        });
    });

    describe(`StandardLibrary`, () => {
        describe(`Table.AddColumn`, () => {
            it(`getHover`, async () => {
                const expression: string = `let foo = Table.AddColumn(1 as table, "bar", each 1) in fo|o`;
                const expected: string = "[let-variable] foo: table [bar: 1, ...]";
                await assertHoverContentEquals(expression, expected);
            });

            it("getSignatureHelp", async () => {
                const signatureHelp: SignatureHelp = await assertGetSignatureHelp("Table.AddColumn(|");

                expect(signatureHelp.activeParameter).to.equal(0);
                expect(signatureHelp.activeSignature).to.equal(0);
                expect(signatureHelp.signatures.length).to.equal(1);

                const signature: SignatureInformation = PQP.Assert.asDefined(signatureHelp.signatures[0]);
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

describe(`moduleLibraryUpdated`, () => {
    describe(`single export`, () => {
        // TODO: This is hardcoded for testing purposes but needs to be kept in sync with the actual SDK output.
        const sdkJsonStr: string = `[{"name":"ExtensionTest.Contents","documentation":null,"completionItemKind":3,"functionParameters":[{"name":"message","type":"nullable text","isRequired":false,"isNullable":true,"caption":null,"description":null,"sampleValues":null,"allowedValues":null,"defaultValue":null,"fields":null,"enumNames":null,"enumCaptions":null}],"isDataSource":true,"type":"any"}]`;

        it("SDK call format", () => {
            const libraryJson: PQLS.LibrarySymbol.LibrarySymbol[] = JSON.parse(sdkJsonStr);
            expect(libraryJson.length).to.equal(1, "expected 1 export");
            expect(libraryJson[0].name).to.equal("ExtensionTest.Contents");
        });

        it("ModuleLibraries", () => {
            const libraryJson: PQLS.LibrarySymbol.LibrarySymbol[] = JSON.parse(sdkJsonStr);
            const moduleLibraries: ModuleLibraries = new ModuleLibraries();
            moduleLibraries.addModuleLibrary("sdk", libraryJson);
            expect(moduleLibraries.getLibraryCount()).to.equal(1, "expected 1 export");
        });
    });
});
