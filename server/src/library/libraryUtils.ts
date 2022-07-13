// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItemKind } from "@microsoft/powerquery-language-services";

import * as SdkLibraryJsonEnUs from "./sdk/sdk-enUs.json";
import * as StandardLibraryJsonEnUs from "./standard/standard-enUs.json";
import { createLibraryTypeResolver, LibraryDefinitionsGetter } from "./libraryTypeResolver";
import { LibraryExportJson, LibraryFunctionParameterJson, LibraryJson } from "./library";

export function getOrCreateStandardLibrary(locale?: string): PQLS.Library.ILibrary {
    return getOrCreateLibrary(
        standardLibraryByLocale,
        standardLibraryDefinitionsByLocale,
        standardJsonByLocale,
        locale ?? PQP.DefaultLocale,
        StandardLibraryJsonEnUs,
    );
}

export function getOrCreateSdkLibrary(
    locale?: string,
    otherLibraryDefinitionsGetters: LibraryDefinitionsGetter[] = [],
): PQLS.Library.ILibrary {
    return getOrCreateLibrary(
        sdkLibraryByLocale,
        sdkLibraryDefinitionsByLocale,
        sdkJsonByLocale,
        locale ?? PQP.DefaultLocale,
        SdkLibraryJsonEnUs,
        otherLibraryDefinitionsGetters,
    );
}

function getOrCreateLibrary(
    libraryByLocale: Map<string, PQLS.Library.ILibrary>,
    definitionsByLocale: Map<string, Map<string, PQLS.Library.TLibraryDefinition>>,
    jsonByLocale: Map<string, LibraryJson>,
    locale: string,
    defaultJson: LibraryJson,
    otherLibraryDefinitionsGetters: LibraryDefinitionsGetter[] = [],
): PQLS.Library.ILibrary {
    if (!libraryByLocale.has(locale)) {
        const libraryDefinitions: PQLS.Library.LibraryDefinitions = getOrCreateLibraryDefinitions(
            definitionsByLocale,
            jsonByLocale,
            locale,
            defaultJson,
        );

        libraryByLocale.set(locale, {
            externalTypeResolver: createLibraryTypeResolver(libraryDefinitions),
            libraryDefinitions,
        });
    }

    const libraryOfNoExternals: PQLS.Library.ILibrary = PQP.Assert.asDefined(libraryByLocale.get(locale));

    if (otherLibraryDefinitionsGetters.length) {
        return {
            externalTypeResolver: createLibraryTypeResolver(
                libraryOfNoExternals.libraryDefinitions,
                otherLibraryDefinitionsGetters,
            ),
            libraryDefinitions: libraryOfNoExternals.libraryDefinitions,
        };
    } else {
        return libraryOfNoExternals;
    }
}

function getOrCreateLibraryDefinitions(
    definitionsByLocale: Map<string, Map<string, PQLS.Library.TLibraryDefinition>>,
    jsonByLocale: Map<string, LibraryJson>,
    locale: string,
    defaultJson: LibraryJson,
): PQLS.Library.LibraryDefinitions {
    if (!definitionsByLocale.has(locale)) {
        const json: LibraryJson = jsonByLocale.get(locale) ?? defaultJson;

        const mapped: Map<string, PQLS.Library.TLibraryDefinition> = new Map(
            json.map((xport: LibraryExportJson) => [xport.name, mapExport(xport)]),
        );

        definitionsByLocale.set(locale, mapped);
    }

    return PQP.MapUtils.assertGet(definitionsByLocale, locale);
}

const sdkLibraryByLocale: Map<string, PQLS.Library.ILibrary> = new Map();
const sdkLibraryDefinitionsByLocale: Map<string, Map<string, PQLS.Library.TLibraryDefinition>> = new Map();
const sdkJsonByLocale: Map<string, LibraryJson> = new Map([[PQP.Locale.en_US, SdkLibraryJsonEnUs]]);

const standardLibraryByLocale: Map<string, PQLS.Library.ILibrary> = new Map();
const standardLibraryDefinitionsByLocale: Map<string, Map<string, PQLS.Library.TLibraryDefinition>> = new Map();
const standardJsonByLocale: Map<string, LibraryJson> = new Map([[PQP.Locale.en_US, StandardLibraryJsonEnUs]]);

export function mapExport(xport: LibraryExportJson): PQLS.Library.TLibraryDefinition {
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
            label: PQP.Language.TypeUtils.nameOf(asPowerQueryType, PQP.Trace.NoOpTraceManagerInstance, undefined),
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
    xport: LibraryExportJson,
    returnType: PQP.Language.Type.TPrimitiveType,
): PQP.Language.Type.DefinedFunction {
    const xportParameters: ReadonlyArray<LibraryFunctionParameterJson> = xport.functionParameters ?? [];

    return PQP.Language.TypeUtils.createDefinedFunction(
        false,
        xportParameters.map((parameter: LibraryFunctionParameterJson) => {
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

function mapParameterToLibraryParameter(parameter: LibraryFunctionParameterJson): PQLS.Library.LibraryParameter {
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
    if (!PQP.Language.ConstantUtils.isPrimitiveTypeConstant(text)) {
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
            if (split[0] !== PQP.Language.Constant.LanguageConstant.Nullable) {
                throw new Error(`expected first word in text to be ${PQP.Language.Constant.LanguageConstant.Nullable}`);
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
