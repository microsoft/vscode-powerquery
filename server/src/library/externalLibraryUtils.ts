// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";

export type ExternalSymbolLibrary = ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;

export function getSymbols(): ReadonlyArray<ExternalSymbolLibrary> {
    return Array.from(externalLibraryByName.values());
}

export function addLibaries(symbols: ReadonlyMap<string, ExternalSymbolLibrary>): void {
    for (const [key, value] of symbols) {
        externalLibraryByName.set(key, value);
    }
}

export function removeLibraries(libraryNames: ReadonlyArray<string>): void {
    for (const libraryName of libraryNames) {
        externalLibraryByName.delete(libraryName);
    }
}

export function getRegisteredModuleNames(): ReadonlyArray<string> {
    return Array.from(externalLibraryByName.keys());
}

/**
 * Returns a map of symbol names that appear in more than one registered module.
 * Key: symbol name, Value: array of module names that contain it.
 */
export function getOverlappingSymbols(): ReadonlyMap<string, ReadonlyArray<string>> {
    const symbolToModules: Map<string, string[]> = new Map();

    for (const [moduleName, symbols] of externalLibraryByName) {
        for (const symbol of symbols) {
            const modules: string[] = symbolToModules.get(symbol.name) ?? [];
            modules.push(moduleName);
            symbolToModules.set(symbol.name, modules);
        }
    }

    const overlaps: Map<string, ReadonlyArray<string>> = new Map();

    for (const [symbolName, modules] of symbolToModules) {
        if (modules.length > 1) {
            overlaps.set(symbolName, modules);
        }
    }

    return overlaps;
}

const externalLibraryByName: Map<string, ExternalSymbolLibrary> = new Map();
