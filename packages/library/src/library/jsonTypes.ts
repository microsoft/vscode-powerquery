// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface Module {
    name: string;
    version: string | undefined;
}

export enum ExportKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type",
}

export interface Export {
    label: string;
    kind: ExportKind;
    summary: string;
    module: Module;
    signatures: Signature[] | undefined;
}

export interface Signature {
    label: string;
    documentation: string | undefined;
    parameters: Parameter[];
}

export interface Parameter {
    label: string;
    documentation: string | undefined;
    labelOffsetStart: number;
    labelOffsetEnd: number;
}
