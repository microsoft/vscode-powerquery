// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";

import { LibrarySymbolUtils } from ".";

export function clear(): void {
    moduleLibraryByUri.clear();
}

export function getAsDynamicLibraryDefinitions(): ReadonlyArray<
    () => ReadonlyMap<string, PQLS.Library.TLibraryDefinition>
> {
    const result: (() => ReadonlyMap<string, PQLS.Library.TLibraryDefinition>)[] = [];

    for (const libraryDefinitions of moduleLibraryByUri.values()) {
        result.push(() => libraryDefinitions);
    }

    return result;
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
