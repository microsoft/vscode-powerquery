// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Library, LibrarySymbol, LibrarySymbolUtils } from "@microsoft/powerquery-language-services";

import * as SdkLibrarySymbolsEnUs from "./sdk/sdk-enUs.json";
import * as StandardLibrarySymbolsEnUs from "./standard/standard-enUs.json";
import { createLibraryTypeResolver, LibraryDefinitionsGetter } from "./libraryTypeResolver";
import { PartialResult, PartialResultUtils } from "@microsoft/powerquery-parser";

export function getOrCreateStandardLibrary(locale?: string): Library.ILibrary {
    return getOrCreateLibrary(
        standardLibraryByLocale,
        standardLibraryDefinitionsByLocale,
        standardLibrarySymbolByLocale,
        locale ?? PQP.DefaultLocale,
        StandardLibrarySymbolsEnUs,
    );
}

export function getOrCreateSdkLibrary(
    locale?: string,
    otherLibraryDefinitionsGetters: LibraryDefinitionsGetter[] = [],
): Library.ILibrary {
    return getOrCreateLibrary(
        sdkLibraryByLocale,
        sdkLibraryDefinitionsByLocale,
        sdkLibrarySymbols,
        locale ?? PQP.DefaultLocale,
        SdkLibrarySymbolsEnUs,
        otherLibraryDefinitionsGetters,
    );
}

function getOrCreateLibrary(
    libraryByLocale: Map<string, Library.ILibrary>,
    definitionsByLocale: Map<string, Library.LibraryDefinitions>,
    librarySymbolsByLocale: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>>,
    locale: string,
    defaultLibrarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>,
    otherLibraryDefinitionsGetters: LibraryDefinitionsGetter[] = [],
): Library.ILibrary {
    if (!libraryByLocale.has(locale)) {
        const libraryDefinitions: Library.LibraryDefinitions = getOrCreateLibraryDefinitions(
            definitionsByLocale,
            librarySymbolsByLocale,
            locale,
            defaultLibrarySymbols,
        );

        libraryByLocale.set(locale, {
            externalTypeResolver: createLibraryTypeResolver(libraryDefinitions),
            libraryDefinitions,
        });
    }

    const libraryOfNoExternals: Library.ILibrary = PQP.Assert.asDefined(libraryByLocale.get(locale));

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
    definitionsByLocale: Map<string, Library.LibraryDefinitions>,
    librarySymbolsByLocale: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>>,
    locale: string,
    defaultLibrarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>,
): Library.LibraryDefinitions {
    if (!definitionsByLocale.has(locale)) {
        const librarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol> =
            librarySymbolsByLocale.get(locale) ?? defaultLibrarySymbols;

        const libraryDefinitionsResult: PartialResult<
            Library.LibraryDefinitions,
            Library.LibraryDefinitions,
            ReadonlyArray<string>
        > = LibrarySymbolUtils.createLibraryDefinitions(librarySymbols);

        if (PartialResultUtils.isOk(libraryDefinitionsResult) || PartialResultUtils.isMixed(libraryDefinitionsResult)) {
            definitionsByLocale.set(locale, libraryDefinitionsResult.value);
        }
    }

    return PQP.MapUtils.assertGet(definitionsByLocale, locale);
}

const sdkLibraryByLocale: Map<string, Library.ILibrary> = new Map();
const sdkLibraryDefinitionsByLocale: Map<string, Library.LibraryDefinitions> = new Map();

const sdkLibrarySymbols: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);

const standardLibraryByLocale: Map<string, Library.ILibrary> = new Map();
const standardLibraryDefinitionsByLocale: Map<string, Library.LibraryDefinitions> = new Map();

const standardLibrarySymbolByLocale: Map<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, StandardLibrarySymbolsEnUs],
]);
