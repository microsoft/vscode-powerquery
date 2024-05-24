// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";

export type ExternalSymbolLibrary = ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;
export type IncomingExternalSymbolLibrary = ExternalSymbolLibrary | null;

export function getSymbols(): ExternalSymbolLibrary[] {
    return Array.from(externalLibraryByName.values());
}

export function setRange(symbols: ReadonlyArray<[string, IncomingExternalSymbolLibrary]>): void {
    symbols.forEach((value: [string, IncomingExternalSymbolLibrary]) => {
        if (value[1] === undefined || value[1] === null) {
            externalLibraryByName.delete(value[0]);
        } else {
            externalLibraryByName.set(value[0], value[1]);
        }
    });
}

const externalLibraryByName: Map<string, ExternalSymbolLibrary> = new Map();
