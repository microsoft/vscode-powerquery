// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import * as SdkLibrarySymbolsEnUs from "./sdk/sdk-enUs.json";
import * as StandardLibrarySymbolsEnUs from "./standard/standard-enUs.json";

export function getSymbolsForLocaleAndMode(
    locale: string,
    mode: "Power Query" | "SDK",
): ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol> {
    switch (mode) {
        case "Power Query":
            return StandardLibrarySymbolByLocale.get(locale) ?? StandardLibrarySymbolsEnUs;

        case "SDK":
            return SdkLibrarySymbols.get(locale) ?? SdkLibrarySymbolsEnUs;

        default:
            throw new PQP.CommonError.InvariantError(`Unknown mode: ${mode}`);
    }
}

export function toLibraryDefinitions(
    librarySymbols: ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>,
): ReadonlyMap<string, PQLS.Library.TLibraryDefinition> {
    const libraryDefinitionsResult: PQP.Result<
        ReadonlyMap<string, PQLS.Library.TLibraryDefinition>,
        PQLS.LibrarySymbolUtils.IncompleteLibraryDefinitions
    > = PQLS.LibrarySymbolUtils.createLibraryDefinitions(librarySymbols);

    let libraryDefinitions: ReadonlyMap<string, PQLS.Library.TLibraryDefinition>;
    let failedLibrarySymbolConversions: ReadonlyArray<PQLS.LibrarySymbolUtils.FailedLibrarySymbolConversion>;

    if (PQP.ResultUtils.isOk(libraryDefinitionsResult)) {
        libraryDefinitions = libraryDefinitionsResult.value;
        failedLibrarySymbolConversions = [];
    } else {
        libraryDefinitions = new Map();
        failedLibrarySymbolConversions = libraryDefinitionsResult.error.failedLibrarySymbolConversions;
    }

    if (failedLibrarySymbolConversions.length) {
        console.warn(`Failed to convert library symbols: ${JSON.stringify(failedLibrarySymbolConversions)}`);
    }

    return libraryDefinitions;
}

const StandardLibrarySymbolByLocale: ReadonlyMap<string, ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, StandardLibrarySymbolsEnUs],
]);

const SdkLibrarySymbols: ReadonlyMap<string, ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);
