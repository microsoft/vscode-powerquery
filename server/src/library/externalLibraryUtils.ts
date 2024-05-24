// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";

export type ExternalSymbolLibrary = ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;
export type IncomingExternalSymbolLibrary = ExternalSymbolLibrary | null;

export function getSymbols(): ReadonlyArray<ExternalSymbolLibrary> {
    return Array.from(externalLibraryByName.values());
}

export function setRange(symbols: ReadonlyMap<string, IncomingExternalSymbolLibrary>): void {
    for (const [key, value] of symbols) {
        if (value === undefined || value === null) {
            externalLibraryByName.delete(key);
        } else {
            externalLibraryByName.set(key, value);
        }
    }
}

const externalLibraryByName: Map<string, ExternalSymbolLibrary> = new Map();
