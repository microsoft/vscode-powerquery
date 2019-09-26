// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, Range, SignatureHelp } from "vscode-languageserver-types";

export interface CompletionItemProviderContext extends ProviderContext {
    text?: string;
    tokenKind?: string;
}

// tslint:disable-next-line: no-empty-interface
export interface HoverProviderContext extends ProviderContext {}

export interface ProviderContext {
    range?: Range;
}

export interface SignatureProviderContext extends ProviderContext {
    argumentOrdinal?: number;
    // TODO: remove optional
    functionName?: string;
}

export interface CompletionItemProvider {
    getCompletionItems(context: CompletionItemProviderContext): Promise<CompletionItem[]>;
}

export interface HoverProvider {
    getHover(identifier: string, context: HoverProviderContext): Promise<Hover | null>;
}

export interface SignatureHelpProvider {
    getSignatureHelp(functionName: string, context: SignatureProviderContext): Promise<SignatureHelp | null>;
}

// Lookup provider for built-in and external libaries/modules.
export interface LibrarySymbolProvider extends CompletionItemProvider, HoverProvider, SignatureHelpProvider {
    includeModules(modules: string[]): void;
}

// TODO: providers for record fields and table columns

export class NullLibrarySymbolProvider implements LibrarySymbolProvider {
    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return [];
    }

    public async getHover(_identifier: string, _context: HoverProviderContext): Promise<Hover | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(
        _functionName: string,
        _context: SignatureProviderContext,
    ): Promise<SignatureHelp | null> {
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public includeModules(_modules: string[]): void {
        // No impact
    }
}
