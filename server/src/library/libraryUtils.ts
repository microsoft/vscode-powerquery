// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    Library,
    LibraryDefinitionUtils,
    LibrarySymbol,
    LibrarySymbolUtils,
} from "@microsoft/powerquery-language-services";
import { PartialResult, PartialResultUtils } from "@microsoft/powerquery-parser";

import * as SdkLibrarySymbolsEnUs from "./sdk/sdk-enUs.json";
import * as StandardLibrarySymbolsEnUs from "./standard/standard-enUs.json";
import { createExternalTypeResolver } from "./libraryTypeResolver";

export function getOrCreateStandardLibrary(locale?: string): Library.ILibrary {
    return getOrCreateLibrary(
        standardLibraryByLocale,
        standardStaticLibraryDefinitionsByLocale,
        standardLibrarySymbolByLocale,
        locale ?? PQP.DefaultLocale,
        StandardLibrarySymbolsEnUs,
        /* dynamicLibraryDefinitions */ [],
    );
}

export function getOrCreateSdkLibrary(
    dynamicLibraryDefinitions: ReadonlyArray<() => ReadonlyMap<string, Library.TLibraryDefinition>>,
    locale?: string,
): Library.ILibrary {
    return getOrCreateLibrary(
        sdkLibraryByLocale,
        sdkStaticLibraryDefinitionsByLocale,
        sdkLibrarySymbols,
        locale ?? PQP.DefaultLocale,
        SdkLibrarySymbolsEnUs,
        dynamicLibraryDefinitions,
    );
}

function getOrCreateLibrary(
    libraryByLocale: Map<string, Library.ILibrary>,
    staticLibraryDefinitionsByLocale: Map<string, ReadonlyMap<string, Library.TLibraryDefinition>>,
    librarySymbolsByLocale: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>>,
    locale: string,
    defaultLibrarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>,
    dynamicLibraryDefinitions: ReadonlyArray<() => ReadonlyMap<string, Library.TLibraryDefinition>>,
): Library.ILibrary {
    if (!libraryByLocale.has(locale)) {
        const staticLibraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition> =
            getOrCreateStaticLibraryDefinitions(
                staticLibraryDefinitionsByLocale,
                librarySymbolsByLocale,
                locale,
                defaultLibrarySymbols,
            );

        const staticLibrary: Library.ILibrary = {
            externalTypeResolver: LibraryDefinitionUtils.externalTypeResolver({
                staticLibraryDefinitions,
                dynamicLibraryDefinitions: () => new Map(),
            }),
            libraryDefinitions: {
                staticLibraryDefinitions,
                dynamicLibraryDefinitions: () => new Map(),
            },
        };

        libraryByLocale.set(locale, staticLibrary);
    }

    const staticLibrary: Library.ILibrary = PQP.Assert.asDefined(libraryByLocale.get(locale));

    if (!dynamicLibraryDefinitions?.length) {
        return staticLibrary;
    }

    return {
        externalTypeResolver: createExternalTypeResolver(staticLibrary, dynamicLibraryDefinitions),
        libraryDefinitions: {
            staticLibraryDefinitions: staticLibrary.libraryDefinitions.staticLibraryDefinitions,
            // Lazily flattens an array of getter functions,
            //  input: (() => T)[]
            //  output: () => T
            dynamicLibraryDefinitions: () =>
                dynamicLibraryDefinitions.reduce(
                    (
                        previousValue: Map<string, Library.TLibraryDefinition>,
                        currentValue: () => ReadonlyMap<string, Library.TLibraryDefinition>,
                    ) => new Map([...previousValue, ...currentValue()]),
                    new Map(),
                ),
        },
    };
}

function getOrCreateStaticLibraryDefinitions(
    staticLibraryDefinitionsByLocale: Map<string, ReadonlyMap<string, Library.TLibraryDefinition>>,
    staticLibrarySymbolsByLocale: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>>,
    locale: string,
    defaultLibrarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>,
): ReadonlyMap<string, Library.TLibraryDefinition> {
    if (!staticLibraryDefinitionsByLocale.has(locale)) {
        const librarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol> =
            staticLibrarySymbolsByLocale.get(locale) ?? defaultLibrarySymbols;

        const libraryDefinitionsResult: PartialResult<
            ReadonlyMap<string, Library.TLibraryDefinition>,
            LibrarySymbolUtils.IncompleteLibraryDefinitions,
            ReadonlyArray<LibrarySymbol.LibrarySymbol>
        > = LibrarySymbolUtils.createLibraryDefinitions(librarySymbols);

        let staticLibraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
        let failedSymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>;

        if (PartialResultUtils.isOk(libraryDefinitionsResult)) {
            staticLibraryDefinitions = libraryDefinitionsResult.value;
            failedSymbols = [];
        } else if (PartialResultUtils.isIncomplete(libraryDefinitionsResult)) {
            staticLibraryDefinitions = libraryDefinitionsResult.partial.libraryDefinitions;
            failedSymbols = libraryDefinitionsResult.partial.invalidSymbols;
        } else {
            staticLibraryDefinitions = new Map();
            failedSymbols = libraryDefinitionsResult.error;
        }

        if (failedSymbols.length) {
            const csvSymbolNames: string = failedSymbols
                .map((librarySymbol: LibrarySymbol.LibrarySymbol) => librarySymbol.name)
                .join(", ");

            console.warn(
                `$libraryJson.setter failed to create library definitions for the following symbolNames: ${csvSymbolNames}`,
            );
        }

        staticLibraryDefinitionsByLocale.set(locale, staticLibraryDefinitions);
    }

    return PQP.MapUtils.assertGet(staticLibraryDefinitionsByLocale, locale);
}

const sdkLibraryByLocale: Map<string, Library.ILibrary> = new Map();
const sdkStaticLibraryDefinitionsByLocale: Map<string, ReadonlyMap<string, Library.TLibraryDefinition>> = new Map();

const sdkLibrarySymbols: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);

const standardLibraryByLocale: Map<string, Library.ILibrary> = new Map();

const standardStaticLibraryDefinitionsByLocale: Map<
    string,
    ReadonlyMap<string, Library.TLibraryDefinition>
> = new Map();

const standardLibrarySymbolByLocale: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, StandardLibrarySymbolsEnUs],
]);
