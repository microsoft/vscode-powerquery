// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import * as StandardLibraryJson from "./standardLibrary.generated.json";
import * as StandardLibraryJsonType from "./standardLibraryTypes";

import { standardLibraryTypeResolver } from "./standardLibraryTypeResolver";

const standardLibraryDefinitions: Map<string, PQLS.Library.TLibraryDefinition> = new Map();
for (const mod of StandardLibraryJson) {
    for (const xport of mod.exports) {
        standardLibraryDefinitions.set(xport.export, mapExport(xport));
    }
}
export const StandardLibraryDefinitions: PQLS.Library.LibraryDefinitions = standardLibraryDefinitions;

export const StandardLibrary: PQLS.Library.ILibrary = {
    externalTypeResolver: standardLibraryTypeResolver,
    libraryDefinitions: StandardLibraryDefinitions,
};

function mapExport(xport: StandardLibraryJsonType.Export): PQLS.Library.TLibraryDefinition {
    assertIsExportKind(xport.kind);

    const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(xport.primitiveType);
    const label: string = xport.export;
    const description: string | undefined = xport.summary;

    switch (xport.kind) {
        case StandardLibraryJsonType.ExportKind.Constant:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Constant,
                label,
                description,
                primitiveType,
                asType: primitiveType,
            };

        case StandardLibraryJsonType.ExportKind.Constructor: {
            const signatures: ReadonlyArray<PQLS.Library.LibraryFunctionSignature> = mapSignaturesToLibraryFunctionSignatures(
                xport.signatures,
                description,
            );

            return {
                kind: PQLS.Library.LibraryDefinitionKind.Constructor,
                description,
                label,
                primitiveType,
                signatures,
                asType: mapLibraryFunctionSignatureToType(signatures, primitiveType),
            };
        }

        case StandardLibraryJsonType.ExportKind.Function: {
            const signatures: ReadonlyArray<PQLS.Library.LibraryFunctionSignature> = mapSignaturesToLibraryFunctionSignatures(
                xport.signatures,
                description,
            );

            return {
                kind: PQLS.Library.LibraryDefinitionKind.Function,
                description,
                label,
                primitiveType,
                signatures,
                asType: mapLibraryFunctionSignatureToType(signatures, primitiveType),
            };
        }

        case StandardLibraryJsonType.ExportKind.Type:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Type,
                description,
                label,
                primitiveType,
                asType: primitiveType,
            };

        default:
            throw PQP.Assert.isNever(xport.kind);
    }
}

function mapLibraryFunctionSignatureToType(
    signatures: ReadonlyArray<PQLS.Library.LibraryFunctionSignature>,
    returnType: PQP.Language.Type.TPrimitiveType,
): PQP.Language.Type.TType {
    const definedSignatures: ReadonlyArray<PQP.Language.Type.DefinedFunction> = signatures.map(
        (signature: PQLS.Library.LibraryFunctionSignature) => {
            const parameters: ReadonlyArray<PQP.Language.Type.FunctionParameter> = signature.parameters.map(
                (parameter: PQLS.Library.LibraryParameter) => {
                    return {
                        isNullable: parameter.isNullable,
                        isOptional: parameter.isOptional,
                        maybeType: parameter.typeKind,
                        nameLiteral: parameter.label,
                    };
                },
            );

            return PQP.Language.TypeUtils.definedFunctionFactory(false, parameters, returnType);
        },
    );

    return PQP.Language.TypeUtils.anyUnionFactory(definedSignatures);
}

function mapSignaturesToLibraryFunctionSignatures(
    signatures: ReadonlyArray<StandardLibraryJsonType.Signature> | null,
    description: string | undefined,
): ReadonlyArray<PQLS.Library.LibraryFunctionSignature> {
    if (!signatures) {
        return [];
    }

    return signatures.map((signature: StandardLibraryJsonType.Signature) => {
        return {
            label: signature.label,
            description,
            parameters: signature.parameters.map(mapParameterToLibraryParameter),
        };
    });
}

function mapParameterToLibraryParameter(parameter: StandardLibraryJsonType.Parameter): PQLS.Library.LibraryParameter {
    const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(parameter.type);

    return {
        isNullable: primitiveType.isNullable,
        isOptional: false,
        label: parameter.label,
        maybeDocumentation: parameter.documentation ?? undefined,
        typeKind: primitiveType.kind,
        signatureLabelEnd: parameter.signatureLabelEnd,
        signatureLabelOffset: parameter.signatureLabelOffset,
    };
}

function assertIsExportKind(text: string): asserts text is StandardLibraryJsonType.ExportKind {
    switch (text) {
        case StandardLibraryJsonType.ExportKind.Constant:
        case StandardLibraryJsonType.ExportKind.Constructor:
        case StandardLibraryJsonType.ExportKind.Function:
        case StandardLibraryJsonType.ExportKind.Type:
            break;

        default:
            throw new Error(`unknown exportKind: ${text}`);
    }
}

function assertGetTypeKind(text: string): PQP.Language.Type.TypeKind {
    if (!PQP.Language.ConstantUtils.isPrimitiveTypeConstantKind(text)) {
        throw new Error(`unknown type: ${text}`);
    }

    return PQP.Language.TypeUtils.typeKindFromPrimitiveTypeConstantKind(text);
}

function assertPrimitiveTypeFromString(text: string): PQP.Language.Type.TPrimitiveType {
    const split: ReadonlyArray<string> = text.split(" ");

    let isNullable: boolean;
    let typeKind: PQP.Language.Type.TypeKind;

    switch (split.length) {
        case 0:
            throw new Error("expected parameter.type to be nullish");

        case 1: {
            isNullable = false;
            typeKind = assertGetTypeKind(text);
            break;
        }

        case 2: {
            if (split[0] !== PQP.Language.Constant.LanguageConstantKind.Nullable) {
                throw new Error(
                    `expected first word in text to be ${PQP.Language.Constant.LanguageConstantKind.Nullable}`,
                );
            }
            isNullable = true;
            typeKind = assertGetTypeKind(split[1]);
            break;
        }

        default:
            throw new Error("expected text to be 1 or 2 words");
    }

    return PQP.Language.TypeUtils.primitiveTypeFactory(isNullable, typeKind);
}
