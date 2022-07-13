// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// The JSON output of a localized standard library.
export type LibraryJson = ReadonlyArray<LibraryExportJson>;

export interface LibraryExportJson {
    readonly name: string;
    readonly documentation: LibraryDocumentationJson | null;
    readonly functionParameters: ReadonlyArray<LibraryFunctionParameterJson> | null;
    readonly completionItemType: number;
    readonly isDataSource: boolean;
    readonly dataType: string;
}

export interface LibraryDocumentationJson {
    readonly description: string | null;
    readonly longDescription: string | null;
    readonly category: string | null;
}

export interface LibraryFunctionParameterJson {
    readonly name: string;
    readonly parameterType: string;
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
    readonly fieldName: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly fieldCaption: string | null;
    readonly fieldDescription: string | null;
}

export interface PowerQueryApi {
    readonly onModuleLibraryUpdated: (workspaceUriPath: string, library: LibraryJson) => void;
}
