// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as StandardLibrary from "./standard.json";
import { Export, ExportKind, Module, Signature, Parameter } from "./jsonTypes";

export type Library = {
    [key: string]: LibraryDefinition;
}

export type LibraryDefinition = Export;

// TODO:
// - Define 'ModuleSets' that reflect the default modules available for a given environment (i.e. Power BI, or the SDK). 
// - Export LibraryLoader and add constructor that takes in a string[] or ModuleSet
// - Modules can be added/removed from LibraryLoader
// - Call LibraryLoader.load() when ready to retrieve definition.

class LibraryLoader {
    public static loadAllModules(): Library {
        return LibraryLoader.loadStandardLibrary();
    }

    private static loadStandardLibrary(): Library {
        let library: Library = {};

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

                library[currentExport.label] = currentExport;
            });
        });

        return library;
    }
}

export const AllModules = LibraryLoader.loadAllModules();