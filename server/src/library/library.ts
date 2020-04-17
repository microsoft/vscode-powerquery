// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LibraryDefinition, LibraryDefinitionKind, Signature } from "./jsonTypes";
import * as StandardLibrary from "./standard.json";

export type Library = Map<string, LibraryDefinition>;

export const AllModules: Library = loadAllModules();

// TODO:
// - Use Visibility to define 'ModuleSets' for a given environment (i.e. Power BI, or the SDK)
// - Export LibraryLoader and add constructor that takes in a string[] or ModuleSet
// - Modules can be added/removed from LibraryLoader
// - Call LibraryLoader.load() when ready to retrieve definition

function loadAllModules(): Library {
    return loadStandardLibrary();
}

function loadStandardLibrary(): Library {
    const library: Library = new Map();

    // standard library is listed by module
    for (const mod of StandardLibrary) {
        for (const exported of mod.exports) {
            const signatures: Signature[] = exported.signatures ?? [];

            library.set(exported.export, {
                ...exported,
                label: exported.export,
                kind: exported.kind as LibraryDefinitionKind,
                module: {
                    name: mod.module,
                    // TODO until there's at least 1 non-null for version there will be typing issues.
                    // eg `mod.version !== null ? mod.version : mod.version` fails as version is always null,
                    // so Typescript always goes to the false ternary expression which is null causing the ternary's
                    // type to become null.
                    version: undefined,
                    visibility: mod.visibility,
                },
                signatures,
            });
        }
    }

    return library;
}
