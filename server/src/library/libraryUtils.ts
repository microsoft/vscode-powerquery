// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import * as SdkLibrarySymbolsEnUs from "./sdk/sdk-enUs.json";
import * as StandardLibrarySymbolsEnUs from "./standard/standard-enUs.json";
import { LibrarySymbolUtils } from ".";
import { wrapSmartTypeResolver } from "./libraryTypeResolver";

export const StandardLibrarySymbolByLocale: ReadonlyMap<
    string,
    ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>
> = new Map([[PQP.Locale.en_US, StandardLibrarySymbolsEnUs]]);

export const SdkLibrarySymbols: ReadonlyMap<string, ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>> = new Map([
    [PQP.Locale.en_US, SdkLibrarySymbolsEnUs],
]);

export function clearCache(): void {
    libraryByCacheKey.clear();
}

export function createCacheKey(locale: string, mode: string): string {
    return `${locale};${mode}`;
}

export function createLibrary(
    staticLibraryDefinitionCollection: ReadonlyArray<ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>>,
    dynamicLibraryDefinitionCollection: ReadonlyArray<() => ReadonlyMap<string, PQLS.Library.TLibraryDefinition>>,
): PQLS.Library.ILibrary {
    const staticLibraryDefinitions: Map<string, PQLS.Library.TLibraryDefinition> = new Map();

    for (const collection of staticLibraryDefinitionCollection) {
        for (const [key, value] of LibrarySymbolUtils.toLibraryDefinitions(collection).entries()) {
            staticLibraryDefinitions.set(key, value);
        }
    }

    const dynamicLibraryDefinitions: () => ReadonlyMap<string, PQLS.Library.TLibraryDefinition> = () => {
        const result: Map<string, PQLS.Library.TLibraryDefinition> = new Map();

        for (const collection of dynamicLibraryDefinitionCollection) {
            for (const [key, value] of collection()) {
                result.set(key, value);
            }
        }

        return result;
    };

    const library: PQLS.Library.ILibrary = {
        externalTypeResolver: wrapSmartTypeResolver(
            PQLS.LibraryDefinitionUtils.externalTypeResolver({
                staticLibraryDefinitions,
                dynamicLibraryDefinitions,
            }),
        ),
        libraryDefinitions: {
            staticLibraryDefinitions,
            dynamicLibraryDefinitions,
        },
    };

    return library;
}

export function createLibraryAndSetCache(
    cacheKey: string,
    staticLibraryDefinitionCollection: ReadonlyArray<ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>>,
    dynamicLibraryDefinitionCollection: ReadonlyArray<() => ReadonlyMap<string, PQLS.Library.TLibraryDefinition>>,
): PQLS.Library.ILibrary {
    const library: PQLS.Library.ILibrary = createLibrary(
        staticLibraryDefinitionCollection,
        dynamicLibraryDefinitionCollection,
    );

    libraryByCacheKey.set(cacheKey, library);

    return library;
}

export function getLibrary(cacheKey: string): PQLS.Library.ILibrary | undefined {
    return libraryByCacheKey.get(cacheKey);
}

const libraryByCacheKey: Map<string, PQLS.Library.ILibrary> = new Map();
