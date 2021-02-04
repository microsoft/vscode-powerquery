// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import * as StandardLibraryJson from "./standardLibrary.generated.json";
import * as StandardLibraryJsonType from "./standardLibraryTypes";

export const StandardLibrary: PQLS.Library.Library = new Map();

for (const mod of StandardLibraryJson) {
    for (const xport of mod.exports) {
        StandardLibrary.set(xport.export, mapExport(xport));
    }
}

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
            };

        case StandardLibraryJsonType.ExportKind.Constructor:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Constructor,
                description,
                label,
                primitiveType,
                signatures: xport.signatures?.map(mapSignature) ?? [],
            };

        case StandardLibraryJsonType.ExportKind.Function:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Function,
                description,
                label,
                primitiveType: assertPrimitiveTypeFromString(xport.primitiveType),
                signatures: xport.signatures?.map(mapSignature) ?? [],
            };

        case StandardLibraryJsonType.ExportKind.Type:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Type,
                description,
                label,
                primitiveType: assertPrimitiveTypeFromString(xport.primitiveType),
            };

        default:
            throw PQP.Assert.isNever(xport.kind);
    }
}

function mapSignature(signature: StandardLibraryJsonType.Signature): PQLS.Library.LibraryFunctionSignature {
    return {
        label: signature.label,
        parameters: signature.parameters.map(mapParameter),
    };
}

function mapParameter(parameter: StandardLibraryJsonType.Parameter): PQLS.Library.LibraryParameter {
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
