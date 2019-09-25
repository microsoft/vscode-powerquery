// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, Range, SymbolKind, SignatureHelp } from "vscode-languageserver-types";

export interface CompletionItemProviderContext extends ProviderContext {
    text?: string;
    tokenKind?: string;
}

export interface HoverProviderContext extends ProviderContext { }

export interface ProviderContext {
    range?: Range;
}

export interface SignatureProviderContext extends ProviderContext {
    argumentOrdinal?: number;
}

export interface Symbol {
    kind: SymbolKind;
    name: string;
}

// TODO: revisit naming
// TODO: will we need to pass the parser token as part of the context?
export interface SymbolProvider {
    getCompletionItems(context: CompletionItemProviderContext): Promise<CompletionItem[]>;
    getHover(identifier: string, context: HoverProviderContext): Promise<Hover | null>;
    getSignatureHelp(functionName: string, context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

// Lookup provider for built-in and external libaries/modules.
export interface LibrarySymbolProvider extends SymbolProvider {
    includeModules(modules: string[]): void;
}

// Provides symbols that exist in the current workspace/query editing context.
export interface EnvironmentSymbolProvider extends SymbolProvider { }

// TODO: providers for record fields and table columns

export abstract class BaseSymbolProvider implements SymbolProvider {
    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return [];
    }

    public async getHover(_identifier: string, _context: HoverProviderContext): Promise<Hover | null> {
        return null;
    }

    public async getSignatureHelp(
        _functionName: string,
        _context: SignatureProviderContext,
    ): Promise<SignatureHelp | null> {
        return null;
    }
}

export class NullLibrarySymbolProvider extends BaseSymbolProvider implements LibrarySymbolProvider {
    includeModules(_modules: string[]): void {
        // No impact
    }
}
