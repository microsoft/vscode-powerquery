// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { LibrarySymbol } from "@microsoft/powerquery-language-services";

import * as SdkLibrarySymbolsEnUs from "./sdk/sdk-enUs.json";
import * as StandardLibrarySymbolsEnUs from "./standard/standard-enUs.json";

export function getSymbols(locale: string, mode: "Power Query" | "SDK"): ReadonlyArray<LibrarySymbol.LibrarySymbol> {
    switch (mode) {
        case "Power Query":
            return StandardLibrarySymbolByLocale.get(locale) ?? StandardLibrarySymbolsEnUs;

        case "SDK":
            return SdkLibrarySymbols.get(locale) ?? SdkLibrarySymbolsEnUs;

        default:
            throw new PQP.CommonError.InvariantError(`Unknown mode: ${mode}`);
    }
}

const StandardLibrarySymbolByLocale: ReadonlyMap<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, StandardLibrarySymbolsEnUs],
]);

const SdkLibrarySymbols: ReadonlyMap<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);
