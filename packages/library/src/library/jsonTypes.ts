// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface Module {
    name: string;
    version: string | null;
}

export enum ExportKind {
    Constant = "Constant",
    Constructor = "Constructor",
    Function = "Function",
    Type = "Type"
}

export interface Export {
    label: string;
    kind: ExportKind;
    summary: string;
    module: Module;
    signatures: Signature[] | null;
}

export interface Signature {
    label: string;
    documentation: string | null;
    parameters: Parameter[];
}

export interface Parameter {
    label: string;
    documentation: string | null;
    labelOffsetStart: number;
    labelOffsetEnd: number;
}