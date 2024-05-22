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
import { wrapSmartTypeResolver } from "./libraryTypeResolver";

export const StandardLibrarySymbolByLocale: ReadonlyMap<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, StandardLibrarySymbolsEnUs],
]);

export const SdkLibrarySymbols: ReadonlyMap<string, ReadonlyArray<LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);

export function clearCache(): void {
    libraryByCacheKey.clear();
}

export function createCacheKey(locale: string, mode: string): string {
    return `${locale};${mode}`;
}

export function createLibrary(
    cacheKey: string,
    staticLibraryDefinitionCollection: ReadonlyArray<ReadonlyArray<LibrarySymbol.LibrarySymbol>>,
    dynamicLibraryDefinitionCollection: ReadonlyArray<() => ReadonlyMap<string, Library.TLibraryDefinition>>,
): Library.ILibrary {
    const staticLibraryDefinitions: Map<string, Library.TLibraryDefinition> = new Map();

    for (const collection of staticLibraryDefinitionCollection) {
        for (const [key, value] of libraryDefinitionsFromLibrarySymbols(collection).entries()) {
            staticLibraryDefinitions.set(key, value);
        }
    }

    const dynamicLibraryDefinitions: () => ReadonlyMap<string, Library.TLibraryDefinition> = () => {
        const result: Map<string, Library.TLibraryDefinition> = new Map();

        for (const collection of dynamicLibraryDefinitionCollection) {
            for (const [key, value] of collection()) {
                result.set(key, value);
            }
        }

        return result;
    };

    const library: Library.ILibrary = {
        externalTypeResolver: wrapSmartTypeResolver(
            LibraryDefinitionUtils.externalTypeResolver({
                staticLibraryDefinitions,
                dynamicLibraryDefinitions,
            }),
        ),
        libraryDefinitions: {
            staticLibraryDefinitions,
            dynamicLibraryDefinitions,
        },
    };

    libraryByCacheKey.set(cacheKey, library);

    return library;
}

export function getLibrary(cacheKey: string): Library.ILibrary | undefined {
    return libraryByCacheKey.get(cacheKey);
}

export function setCacheAndReturn(cacheKey: string, library: Library.ILibrary): Library.ILibrary {
    libraryByCacheKey.set(cacheKey, library);

    return library;
}

const libraryByCacheKey: Map<string, Library.ILibrary> = new Map();

function libraryDefinitionsFromLibrarySymbols(
    librarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>,
): ReadonlyMap<string, Library.TLibraryDefinition> {
    const libraryDefinitionsResult: PartialResult<
        ReadonlyMap<string, Library.TLibraryDefinition>,
        LibrarySymbolUtils.IncompleteLibraryDefinitions,
        ReadonlyArray<LibrarySymbol.LibrarySymbol>
    > = LibrarySymbolUtils.createLibraryDefinitions(librarySymbols);

    let libraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
    let failedSymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>;

    if (PartialResultUtils.isOk(libraryDefinitionsResult)) {
        libraryDefinitions = libraryDefinitionsResult.value;
        failedSymbols = [];
    } else if (PartialResultUtils.isIncomplete(libraryDefinitionsResult)) {
        libraryDefinitions = libraryDefinitionsResult.partial.libraryDefinitions;
        failedSymbols = libraryDefinitionsResult.partial.invalidSymbols;
    } else {
        libraryDefinitions = new Map();
        failedSymbols = libraryDefinitionsResult.error;
    }

    if (failedSymbols.length) {
        const csvSymbolNames: string = failedSymbols
            .map((librarySymbol: LibrarySymbol.LibrarySymbol) => librarySymbol.name)
            .join(", ");

        console.warn(
            `LibraryUtils.libraryDefinitionsFromLibrarySymbols failed to create library definitions for the following symbolNames: [${csvSymbolNames}]`,
        );
    }

    return libraryDefinitions;
}
