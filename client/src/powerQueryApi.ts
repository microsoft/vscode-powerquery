// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type * as PQLS from "@microsoft/powerquery-language-services";

export type LibrarySymbol = PQLS.LibrarySymbol.LibrarySymbol;
export type LibrarySymbolDocumentation = PQLS.LibrarySymbol.LibrarySymbolDocumentation;
export type LibrarySymbolFunctionParameter = PQLS.LibrarySymbol.LibrarySymbolFunctionParameter;
export type LibrarySymbolRecordField = PQLS.LibrarySymbol.LibrarySymbolRecordField;
export type LibraryJson = ReadonlyArray<LibrarySymbol>;

// TODO: Rename and deprecate old API once the PQ SDK has been updated.
export interface PowerQueryApi {
    readonly onModuleLibraryUpdated: (workspaceUriPath: string, library: LibraryJson) => void;
    readonly setLibrarySymbols: (librarySymbols: [string, LibraryJson | null][]) => Promise<void>;
}
