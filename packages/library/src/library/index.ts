// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { LibraryDefinition, LibraryDefinitionKind, Parameter, Signature } from "./jsonTypes";
import * as StandardLibrary from "./standard.json";

export type Library = Map<string, LibraryDefinition>;

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
    for (const mod of StandardLibrary) {
        for (const exported of mod.exports) {
            let signatures: Signature[] = [];

            if (exported.signatures !== null) {
                signatures = exported.signatures.map(signature => {
                    const parameters: ReadonlyArray<Parameter> = signature.parameters.map(parameter => {
                        return {
                            label: parameter.label,
                            documentation: parameter.documentation,
                            labelOffsetStart: parameter.signatureLabelOffset,
                            labelOffsetEnd: parameter.signatureLabelEnd,
                        };
                    });

                    return {
                        label: signature.label,
                        documentation: signature.documentation,
                        parameters,
                    };
                });
            }

            library.set(exported.export, {
                label: exported.export,
                kind: exported.kind as LibraryDefinitionKind,
                summary: exported.summary,
                module: {
                    name: mod.module,
                    // TODO until there's at least 1 non-null for version there will be typing issues.
                    // eg `mod.version !== null ? mod.version : mod.version` fails as version is always null,
                    // so Typescript always goes to the false ternary expression which is null causing the ternary's
                    // type to become null.
                    version: undefined,
                },
                signatures,
            });
        }
    }

    return library;
}
