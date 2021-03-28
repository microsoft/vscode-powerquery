// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import * as StandardLibraryJson from "./standardLibrary.generated.json";
import * as StandardLibraryJsonType from "./standardLibraryTypes";

import { standardLibraryTypeResolver } from "./standardLibraryTypeResolver";

const standardLibraryDefinitions: Map<string, PQLS.Library.TLibraryDefinition> = new Map();
for (const xport of StandardLibraryJson) {
    standardLibraryDefinitions.set(xport.name, mapExport(xport));
}
export const StandardLibraryDefinitions: PQLS.Library.LibraryDefinitions = standardLibraryDefinitions;

export const StandardLibrary: PQLS.Library.ILibrary = {
    externalTypeResolver: standardLibraryTypeResolver,
    libraryDefinitions: StandardLibraryDefinitions,
};

function mapExport(xport: StandardLibraryJsonType.StandardLibraryExport): PQLS.Library.TLibraryDefinition {
    const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(xport.dataType);
    const label: string = xport.name;
    const description: string = xport.documentation?.description ?? "No description available";

    if (primitiveType.kind === PQP.Language.Type.TypeKind.Type) {
        return {
            kind: PQLS.Library.LibraryDefinitionKind.Type,
            label,
            description,
            primitiveType,
            asType: primitiveType,
        };
    } else if (xport.functionParameters) {
        return {
            kind: PQLS.Library.LibraryDefinitionKind.Function,
            label,
            primitiveType,
            description,
            parameters: xport.functionParameters.map(mapParameterToLibraryParameter),
            asType: mapLibraryFunctionSignatureToType(xport, primitiveType),
        };
    } else {
        return {
            kind: PQLS.Library.LibraryDefinitionKind.Constant,
            label,
            description,
            primitiveType,
            asType: primitiveType,
        };
    }
}

function mapLibraryFunctionSignatureToType(
    xport: StandardLibraryJsonType.StandardLibraryExport,
    returnType: PQP.Language.Type.TPrimitiveType,
): PQP.Language.Type.DefinedFunction {
    const xportParameters: ReadonlyArray<StandardLibraryJsonType.StandardLibraryFunctionParameter> =
        xport.functionParameters ?? [];

    return PQP.Language.TypeUtils.definedFunctionFactory(
        false,
        xportParameters.map((parameter: StandardLibraryJsonType.StandardLibraryFunctionParameter) => {
            const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(
                parameter.parameterType,
            );

            return {
                isNullable: primitiveType.isNullable,
                isOptional: !parameter.isRequired,
                maybeType: primitiveType.kind,
                nameLiteral: parameter.name,
            };
        }),
        returnType,
    );
}

function mapParameterToLibraryParameter(
    parameter: StandardLibraryJsonType.StandardLibraryFunctionParameter,
): PQLS.Library.LibraryParameter {
    const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(parameter.parameterType);

    return {
        isNullable: primitiveType.isNullable,
        isOptional: false,
        label: parameter.name,
        maybeDocumentation: parameter.description ?? undefined,
        typeKind: primitiveType.kind,
    };
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
