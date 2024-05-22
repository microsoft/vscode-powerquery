// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";

import { LibrarySymbolUtils } from ".";

export function clearCache(): void {
    moduleLibraryByUri.clear();
}

export function getAsDynamicLibraryDefinitions(
    uri: string,
): () => ReadonlyMap<string, PQLS.Library.TLibraryDefinition> {
    return () => {
        for (const [connectorUri, libraryDefinitions] of moduleLibraryByUri.entries()) {
            if (uri.startsWith(connectorUri)) {
                return libraryDefinitions;
            }
        }

        return new Map();
    };
}

export function getModuleCount(): number {
    return moduleLibraryByUri.size;
}

export function onModuleAdded(uri: string, moduleSymbols: ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>): void {
    moduleLibraryByUri.set(uri, LibrarySymbolUtils.toLibraryDefinitions(moduleSymbols));
}

export function onModuleRemoved(uri: string): void {
    moduleLibraryByUri.delete(uri);
}

const moduleLibraryByUri: Map<string, ReadonlyMap<string, PQLS.Library.TLibraryDefinition>> = new Map();
