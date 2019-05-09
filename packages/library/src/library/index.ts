// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as StandardLibrary from "./standard.json";

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

export type LibraryExports = {
    [key: string]: Export;
}

export function loadStandardLibrary(): LibraryExports {
    let exports: LibraryExports = {};

    // standard library is listed by module
    StandardLibrary.forEach(m => {
        const currentModule: Module = {
            name: m.module,
            version: m.version
        };

        m.exports.forEach(e => {
            const currentExport: Export = {
                label: e.export,
                kind: <ExportKind>e.kind,
                summary: e.summary,
                module: currentModule,
                signatures: null
            };

            if (e.signatures !== null) {
                currentExport.signatures = [];
                e.signatures.forEach(s => {
                    const currentSignature: Signature = {
                        label: s.label,
                        documentation: s.documentation,
                        parameters: []
                    };

                    s.parameters.forEach(p => {
                        const currentParameter: Parameter = {
                            label: p.label,
                            documentation: p.documentation,
                            labelOffsetStart: p.signatureLabelOffset,
                            labelOffsetEnd: p.signatureLabelEnd
                        };

                        currentSignature.parameters.push(currentParameter);
                    });

                    currentExport.signatures!.push(currentSignature);
                });
            }

            exports[currentExport.label] = currentExport;
        });
    });

    return exports;
}