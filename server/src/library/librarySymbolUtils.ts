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
    const libraryDefinitionsResult: PQP.PartialResult<
        ReadonlyMap<string, PQLS.Library.TLibraryDefinition>,
        PQLS.LibrarySymbolUtils.IncompleteLibraryDefinitions,
        ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>
    > = PQLS.LibrarySymbolUtils.createLibraryDefinitions(librarySymbols);

    let libraryDefinitions: ReadonlyMap<string, PQLS.Library.TLibraryDefinition>;
    let invalidSymbols: ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;

    if (PQP.PartialResultUtils.isOk(libraryDefinitionsResult)) {
        libraryDefinitions = libraryDefinitionsResult.value;
        invalidSymbols = [];
    } else if (PQP.PartialResultUtils.isIncomplete(libraryDefinitionsResult)) {
        libraryDefinitions = libraryDefinitionsResult.partial.libraryDefinitions;
        invalidSymbols = libraryDefinitionsResult.partial.invalidSymbols;
    } else {
        libraryDefinitions = new Map();
        invalidSymbols = libraryDefinitionsResult.error;
    }

    if (invalidSymbols.length) {
        console.warn(`Failed to convert library symbols: ${JSON.stringify(invalidSymbols)}`);
    }

    return libraryDefinitions;
}

const StandardLibrarySymbolByLocale: ReadonlyMap<string, ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, StandardLibrarySymbolsEnUs],
]);

const SdkLibrarySymbols: ReadonlyMap<string, ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);
