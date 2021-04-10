// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type StandardLibrary = ReadonlyArray<StandardLibraryExport>;

export interface StandardLibraryExport {
    readonly name: string;
    readonly documentation: StandardLibraryDocumentation | null;
    readonly functionParameters: ReadonlyArray<StandardLibraryFunctionParameter> | null;
    readonly completionItemType: number;
    readonly isDataSource: boolean;
    readonly dataType: string;
}

export interface StandardLibraryDocumentation {
    readonly description: string;
    readonly longDescription: string | null;
}

export interface StandardLibraryFunctionParameter {
    readonly name: string;
    readonly parameterType: string;
    readonly isRequired: boolean;
    readonly isNullable: boolean;
    readonly caption: string | null;
    readonly description: string | null;
    readonly sampleValues: ReadonlyArray<string | number> | null;
    readonly allowedValues: ReadonlyArray<string | number> | null;
    readonly defaultValue: string | number | null;
    readonly fields: ReadonlyArray<StandardLibraryField> | null;
    readonly enumNames: ReadonlyArray<string> | null;
    readonly enumCaptions: ReadonlyArray<string> | ReadonlyArray<null> | null;
}

export interface StandardLibraryField {
    readonly fieldName: string;
    readonly type: string;
    readonly isRequired: boolean;
    readonly fieldCaption: string | null;
    readonly fieldDescription: string | null;
}
