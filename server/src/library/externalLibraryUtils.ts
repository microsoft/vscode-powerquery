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

const externalLibraryByName: Map<string, ExternalSymbolLibrary> = new Map();
