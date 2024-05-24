// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type * as PQLS from "@microsoft/powerquery-language-services";

export type LibrarySymbol = PQLS.LibrarySymbol.LibrarySymbol;
export type LibrarySymbolDocumentation = PQLS.LibrarySymbol.LibrarySymbolDocumentation;
export type LibrarySymbolFunctionParameter = PQLS.LibrarySymbol.LibrarySymbolFunctionParameter;
export type LibrarySymbolRecordField = PQLS.LibrarySymbol.LibrarySymbolRecordField;
export type LibraryJson = ReadonlyArray<LibrarySymbol>;

export interface PowerQueryApi {
    readonly onModuleLibraryUpdated: (workspaceUriPath: string, library: LibraryJson) => void;
    // Ideally the parameter would be a ReadonlyMap, but that isn't supported by JSON-RPC libraries.
    readonly setLibrarySymbols: (librarySymbols: ReadonlyArray<[string, LibraryJson | null]>) => Promise<void>;
}
