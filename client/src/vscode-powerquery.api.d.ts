// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type { LanguageClient } from "vscode-languageclient/node";

// TODO: Consolidate declarations between this file and librarySymbol.d.ts.

// The JSON output of a localized standard library.
export type LibraryJson = ReadonlyArray<LibraryExportJson>;

export interface LibraryExportJson {
    readonly name: string;
    readonly documentation: LibraryDocumentationJson | null;
    readonly functionParameters: ReadonlyArray<LibraryFunctionParameterJson> | null;
    readonly completionItemKind: number;
    readonly isDataSource: boolean;
    readonly type: string;
}

export interface LibraryDocumentationJson {
    readonly description: string | null;
    readonly longDescription: string | null;
}

export interface LibraryFunctionParameterJson {
    readonly name: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly isNullable: boolean;
    readonly caption: string | null;
    readonly description: string | null;
    readonly sampleValues: ReadonlyArray<string | number> | null;
    readonly allowedValues: ReadonlyArray<string | number> | null;
    readonly defaultValue: string | number | null;
    readonly fields: ReadonlyArray<LibraryFieldJson> | null;
    readonly enumNames: ReadonlyArray<string> | null;
    readonly enumCaptions: ReadonlyArray<string> | ReadonlyArray<null> | null;
}

export interface LibraryFieldJson {
    readonly name: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly caption: string | null;
    readonly description: string | null;
}

export interface PowerQueryApi {
    readonly languageClient: LanguageClient;
    readonly onModuleLibraryUpdated: (workspaceUriPath: string, library: LibraryJson) => void;
}
