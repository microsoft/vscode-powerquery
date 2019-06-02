// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Export, ExportKind, Module, Parameter, Signature } from "./jsonTypes";
import * as StandardLibrary from "./standard.json";

export type Library = Map<string, Export>;

export const AllModules: Library = loadAllModules();

// TODO:
// - Define 'ModuleSets' that reflect the default modules available for a given environment (i.e. Power BI, or the SDK).
// - Export LibraryLoader and add constructor that takes in a string[] or ModuleSet
// - Modules can be added/removed from LibraryLoader
// - Call LibraryLoader.load() when ready to retrieve definition.

function loadAllModules(): Library {
    return loadStandardLibrary();
}

function loadStandardLibrary(): Library {
    const library: Library = new Map();

    // standard library is listed by module
    StandardLibrary.forEach(m => {
        const currentModule: Module = {
            name: m.module,
            version: m.version,
        };

        m.exports.forEach(e => {
            const currentExport: Export = {
                label: e.export,
                kind: e.kind as ExportKind,
                summary: e.summary,
                module: currentModule,
                signatures: null,
            };

            if (e.signatures !== null) {
                currentExport.signatures = [];
                e.signatures.forEach(s => {
                    const currentSignature: Signature = {
                        label: s.label,
                        documentation: s.documentation,
                        parameters: [],
                    };

                    s.parameters.forEach(p => {
                        const currentParameter: Parameter = {
                            label: p.label,
                            documentation: p.documentation,
                            labelOffsetStart: p.signatureLabelOffset,
                            labelOffsetEnd: p.signatureLabelEnd,
                        };

                        currentSignature.parameters.push(currentParameter);
                    });

                    currentExport.signatures!.push(currentSignature);
                });
            }

            library.set(currentExport.label, currentExport);
        });
    });

    return library;
}
