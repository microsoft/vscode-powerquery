// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import { LibraryDefinitionsGetter } from "./libraryTypeResolver";
import { ModuleLibrary } from "./moduleLibraries";

// TODO: Fix alignment of LibraryJson and ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>
export type ExternalSymbolLibrary = ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;
export type IncomingExternalSymbolLibrary = ExternalSymbolLibrary | undefined | null;

export class ExternalSymbolLibraries {
    private readonly libraries: Map<string, ModuleLibrary> = new Map();

    public set(module: string, library: IncomingExternalSymbolLibrary): void {
        if (library) {
            const moduleLibrary: ModuleLibrary = new ModuleLibrary();
            moduleLibrary.libraryJson = library;
            this.libraries.set(module, moduleLibrary);
        } else {
            this.libraries.delete(module);
        }
    }

    public setRange(symbols: [string, IncomingExternalSymbolLibrary][]): void {
        symbols.forEach((value: [string, IncomingExternalSymbolLibrary]) => this.set(value[0], value[1]));
    }

    public getLibaryDefinitionGetters(): LibraryDefinitionsGetter[] {
        return Array.from(this.libraries.values()).map((value: ModuleLibrary) => value.libraryDefinitionsGetter);
    }
}
