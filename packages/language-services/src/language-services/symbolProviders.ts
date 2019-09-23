// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, SymbolKind, SignatureHelp } from "vscode-languageserver-types";

export interface ProviderContext {

}

export interface CompletionItemProviderContext extends ProviderContext {

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
    getCompletionItems(context: CompletionItemProviderContext): Promise<CompletionItem[] | null>;
    getHover(identifier: string, context: ProviderContext): Promise<Hover | null>;
    getSignatureHelp(functionName: string, context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

// Lookup provider for built-in and external libaries/modules.
export interface LibrarySymbolProvider extends SymbolProvider {
    includeModules(modules: string[]): void;
}

// Provides symbols that exist in the current workspace/query editing context.
export interface EnvironmentSymbolProvider extends SymbolProvider {

}

// TODO: providers for record fields and table columns

export abstract class BaseSymbolProvider implements SymbolProvider {
    public async getCompletionItems(context: CompletionItemProviderContext): Promise<CompletionItem[] | null> {
        return null;
    }

    public async getHover(identifier: string, context: ProviderContext): Promise<Hover | null> {
        return null;
    }

    public async getSignatureHelp(functionName: string, context: SignatureProviderContext): Promise<SignatureHelp | null> {
        return null;
    }
}

export class NullLibrarySymbolProvider extends BaseSymbolProvider implements LibrarySymbolProvider {
    includeModules(modules: string[]): void {
        // No impact
    }
}
