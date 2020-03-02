// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const enum LibraryDefinitionKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type",
}

export interface Module {
    readonly name: string;
    readonly version: string | undefined;
    readonly visibility: Visibility;
}

export interface LibraryDefinition {
    readonly label: string;
    readonly kind: LibraryDefinitionKind;
    // TODO: should this be a string enum?
    readonly primitiveType: string;
    readonly summary: string;
    // tslint:disable-next-line: no-reserved-keywords
    readonly module: Module;
    readonly signatures: ReadonlyArray<Signature>;
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
    // tslint:disable-next-line: no-reserved-keywords
    readonly type: string;
}

export interface Visibility {
    readonly isInternal: boolean;
    readonly isSdkOnly: boolean;
    readonly isSdkVisible: boolean;
}
