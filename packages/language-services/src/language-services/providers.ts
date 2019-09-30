// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, Range, SignatureHelp } from "vscode-languageserver-types";

export interface CompletionItemProvider {
    getCompletionItems(context: CompletionItemProviderContext): Promise<CompletionItem[]>;
}

export interface CompletionItemProviderContext extends ProviderContext {
    readonly text?: string;
    readonly tokenKind?: string;
}

export interface HoverProvider {
    getHover(context: HoverProviderContext): Promise<Hover | null>;
}

export interface HoverProviderContext extends ProviderContext {
    readonly identifier: string;
}

// Lookup provider for built-in and external libaries/modules.
export interface LibrarySymbolProvider extends CompletionItemProvider, HoverProvider, SignatureHelpProvider {
    includeModules(modules: string[]): void;
}

export interface EnvironmentSymbolProvider extends CompletionItemProvider, HoverProvider, SignatureHelpProvider {}

export interface ProviderContext {
    readonly range?: Range;
}

export interface SignatureHelpProvider {
    getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

export interface SignatureProviderContext extends ProviderContext {
    readonly argumentOrdinal?: number;
    readonly functionName: string;
}

// TODO: providers for record fields and table columns

export class NullLibrarySymbolProvider implements LibrarySymbolProvider {
    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return [];
    }

    public async getHover(_context: HoverProviderContext): Promise<Hover | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public includeModules(_modules: string[]): void {
        // No impact
    }
}
