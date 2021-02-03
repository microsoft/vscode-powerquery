// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as PQLS from "@microsoft/powerquery-language-services";

import * as StandardLibraryJson from "./standardLibrary.json";
import * as StandardLibraryJsonType from "./standardLibraryTypes";
import { Type } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

export const StandardLibrary: PQLS.Library.Library = standardLibraryFactory();

function standardLibraryFactory(): PQLS.Library.Library {
    const library: PQLS.Library.Library = new Map();

    for (const module_ of StandardLibraryJson) {
        for (const export_ of module_.exports) {
            library.set(export_.export, mapExport(export_));
        }
    }

    return library;
}

function mapExport(export_: StandardLibraryJsonType.Export): PQLS.Library.TLibraryDefinition {
    assertIsExportKind(export_.kind);

    const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(export_.primitiveType);
    let name: string = export_.export;
    let description: string | undefined = export_.summary;

    switch (export_.kind) {
        case StandardLibraryJsonType.ExportKind.Constant:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Constant,
                name,
                description,
                primitiveType,
            };

        case StandardLibraryJsonType.ExportKind.Constructor:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Constructor,
                description,
                name,
                primitiveType,
            };

        case StandardLibraryJsonType.ExportKind.Function:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Function,
                description,
                name,
                primitiveType: assertPrimitiveTypeFromString(export_.primitiveType),
                signatures: export_.signatures?.map(mapSignature) ?? [],
            };

        case StandardLibraryJsonType.ExportKind.Type:
            return {
                kind: PQLS.Library.LibraryDefinitionKind.Type,
                description,
                name,
                primitiveType: assertPrimitiveTypeFromString(export_.primitiveType),
            };

        default:
            throw PQP.Assert.isNever(export_.kind);
    }
}

function mapSignature(signature: StandardLibraryJsonType.Signature): PQLS.Library.LibraryFunctionSignature {
    return {
        name: signature.label,
        parameters: signature.parameters.map(mapParameter),
    };
}

function mapParameter(parameter: StandardLibraryJsonType.Parameter): PQLS.Library.LibraryParameter {
    const primitiveType: Type.TPrimitiveType = assertPrimitiveTypeFromString(parameter.type);

    return {
        isNullable: primitiveType.isNullable,
        isOptional: false,
        maybeDocumentation: parameter.documentation ?? undefined,
        maybeType: primitiveType.kind,
        nameLiteral: parameter.label,
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

function assertIsTypeKind(text: string): asserts text is PQP.Language.Type.TypeKind {
    if (!PQP.Language.TypeUtils.isTypeKind(text)) {
        throw new Error(`unknown type: ${text}`);
    }
}

function assertPrimitiveTypeFromString(text: string): PQP.Language.Type.TPrimitiveType {
    const split = text.split(" ");

    let isNullable: boolean;
    let typeKind: PQP.Language.Type.TypeKind;

    switch (split.length) {
        case 0:
            throw new Error("expected parameter.type to be nullish");

        case 1: {
            assertIsTypeKind(text);
            isNullable = false;
            typeKind = text;
            break;
        }

        case 2: {
            if (split[0] !== PQP.Language.Constant.LanguageConstantKind.Nullable) {
                throw new Error(
                    `expected first word in text to be ${PQP.Language.Constant.LanguageConstantKind.Nullable}`,
                );
            }
            isNullable = true;
            assertIsTypeKind(split[1]);
            typeKind = split[1];
            break;
        }

        default:
            throw new Error("expected text to be 1 or 2 words");
    }

    return PQP.Language.TypeUtils.primitiveTypeFactory(isNullable, typeKind);
}
