// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { CompletionItemKind } from "@microsoft/powerquery-language-services";

import * as StandardLibraryEnUs from "./bylocalization/enUs.json";
import * as StandardLibraryJsonType from "./standardLibraryTypes";

import { createStandardLibraryTypeResolver } from "./standardLibraryTypeResolver";

export function getOrCreateStandardLibrary(locale?: string): PQLS.Library.ILibrary {
    locale = locale ?? PQP.Locale.en_US;

    if (!libraryByLocale.has(locale)) {
        const libraryDefinitions: PQLS.Library.LibraryDefinitions = getOrCreateStandardLibraryDefinitions(locale);

        libraryByLocale.set(locale, {
            externalTypeResolver: createStandardLibraryTypeResolver(libraryDefinitions),
            libraryDefinitions,
        });
    }

    return PQP.Assert.asDefined(libraryByLocale.get(locale));
}

function getOrCreateStandardLibraryDefinitions(locale: string): PQLS.Library.LibraryDefinitions {
    if (!libraryDefinitionsByLocale.has(locale)) {
        const json: StandardLibraryJsonType.StandardLibrary = jsonByLocale.get(locale) ?? StandardLibraryEnUs;
        const mapped: Map<string, PQLS.Library.TLibraryDefinition> = new Map(
            json.map((xport: StandardLibraryJsonType.StandardLibraryExport) => [xport.name, mapExport(xport)]),
        );
        libraryDefinitionsByLocale.set(locale, mapped);
    }

    return PQP.Assert.asDefined(libraryDefinitionsByLocale.get(locale));
}

const jsonByLocale: Map<string, StandardLibraryJsonType.StandardLibrary> = new Map([
    [PQP.Locale.en_US, StandardLibraryEnUs],
]);

const libraryByLocale: Map<string, PQLS.Library.ILibrary> = new Map();

const libraryDefinitionsByLocale: Map<string, Map<string, PQLS.Library.TLibraryDefinition>> = new Map();

function mapExport(xport: StandardLibraryJsonType.StandardLibraryExport): PQLS.Library.TLibraryDefinition {
    const primitiveType: PQP.Language.Type.TPrimitiveType = assertPrimitiveTypeFromString(xport.dataType);
    const label: string = xport.name;
    const description: string = xport.documentation?.description ?? "No description available";

    if (primitiveType.kind === PQP.Language.Type.TypeKind.Type) {
        return {
            kind: PQLS.Library.LibraryDefinitionKind.Type,
            label,
            description,
            asPowerQueryType: primitiveType,
            completionItemKind: assertGetCompletionItemKind(xport.completionItemType),
        };
    } else if (xport.functionParameters) {
        const asPowerQueryType: PQP.Language.Type.DefinedFunction = mapLibraryFunctionSignatureToType(
            xport,
            primitiveType,
        );
        return {
            kind: PQLS.Library.LibraryDefinitionKind.Function,
            label: PQP.Language.TypeUtils.nameOf(asPowerQueryType),
            description,
            asPowerQueryType,
            completionItemKind: assertGetCompletionItemKind(xport.completionItemType),
            parameters: xport.functionParameters.map(mapParameterToLibraryParameter),
        };
    } else {
        return {
            kind: PQLS.Library.LibraryDefinitionKind.Constant,
            label,
            description,
            asPowerQueryType: primitiveType,
            completionItemKind: assertGetCompletionItemKind(xport.completionItemType),
        };
    }
}

function mapLibraryFunctionSignatureToType(
    xport: StandardLibraryJsonType.StandardLibraryExport,
    returnType: PQP.Language.Type.TPrimitiveType,
): PQP.Language.Type.DefinedFunction {
    const xportParameters: ReadonlyArray<StandardLibraryJsonType.StandardLibraryFunctionParameter> =
        xport.functionParameters ?? [];

    return PQP.Language.TypeUtils.createDefinedFunction(
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

function assertGetCompletionItemKind(variant: number): CompletionItemKind {
    switch (variant) {
        case CompletionItemKind.Constant:
        case CompletionItemKind.Constructor:
        case CompletionItemKind.Enum:
        case CompletionItemKind.EnumMember:
        case CompletionItemKind.Event:
        case CompletionItemKind.Field:
        case CompletionItemKind.File:
        case CompletionItemKind.Folder:
        case CompletionItemKind.Function:
        case CompletionItemKind.Interface:
        case CompletionItemKind.Keyword:
        case CompletionItemKind.Method:
        case CompletionItemKind.Module:
        case CompletionItemKind.Operator:
        case CompletionItemKind.Property:
        case CompletionItemKind.Reference:
        case CompletionItemKind.Snippet:
        case CompletionItemKind.Struct:
        case CompletionItemKind.Text:
        case CompletionItemKind.TypeParameter:
        case CompletionItemKind.Unit:
        case CompletionItemKind.Value:
        case CompletionItemKind.Variable:
            return variant;

        default:
            throw new PQP.CommonError.InvariantError(`unknown CompletionItemKind variant value`, { variant });
    }
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

    return PQP.Language.TypeUtils.createPrimitiveType(isNullable, typeKind);
}
