// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type StandardLibrary = ReadonlyArray<Module>;

export const enum ExportKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type",
}

export interface Module {
    readonly exports: ReadonlyArray<Export>;
    readonly module: string;
    readonly version: string | null;
    readonly visibility: Visibility;
}

export interface Export {
    readonly export: string;
    readonly kind: string;
    readonly primitiveType: string;
    readonly summary: string;
    readonly signatures: ReadonlyArray<Signature> | null;
}

export interface Signature {
    readonly label: string;
    readonly parameters: ReadonlyArray<Parameter>;
}

export interface Parameter {
    readonly documentation: string | undefined | null;
    readonly label: string;
    readonly signatureLabelOffset: number;
    readonly signatureLabelEnd: number;
    readonly type: string;
}

export interface Visibility {
    readonly isInternal: boolean;
    readonly isSdkOnly: boolean;
    readonly isSdkVisible: boolean;
}
