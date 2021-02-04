// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import type { CompletionItem, Hover, SignatureHelp, SignatureInformation } from "vscode-languageserver-types";

import * as Utils from "./utils";

import { getStandardLibrary } from "./standardLibrary";

export function createLibraryProvider(): StaticLibraryProvider {
    return new StaticLibraryProvider();
}

class StaticLibraryProvider implements PQLS.LibraryProvider {
    public readonly library: PQLS.Library.Library;
    private cachedCompletionItems: CompletionItem[] | undefined;

    constructor() {
        this.library = getStandardLibrary();
    }

    public async getCompletionItems(context: PQLS.CompletionItemProviderContext): Promise<CompletionItem[]> {
        if (context.range) {
            return Utils.cloneCompletionItemsWithRange(this.getCachedCompletionItems(), context.range);
        }

        return this.getCachedCompletionItems();
    }

    public async getHover(context: PQLS.HoverProviderContext): Promise<Hover | null> {
        const definition: PQLS.Library.TLibraryDefinition | undefined = this.library.get(context.identifier);
        if (definition) {
            return Utils.libraryDefinitionToHover(definition, context.range);
        }

        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(context: PQLS.SignatureProviderContext): Promise<SignatureHelp | null> {
        const functionName: string | undefined = context.functionName;

        if (functionName === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const maybeDefinition: PQLS.Library.TLibraryDefinition | undefined = this.library.get(functionName);
        if (maybeDefinition?.kind !== PQLS.Library.LibraryDefinitionKind.Function) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const signatures: SignatureInformation[] = Utils.signatureInformation(maybeDefinition);

        return {
            signatures,
            // tslint:disable-next-line: no-null-keyword
            activeParameter: context.argumentOrdinal ?? null,
            activeSignature: signatures.length - 1,
        };
    }

    private getCachedCompletionItems(): CompletionItem[] {
        if (this.cachedCompletionItems === undefined) {
            const cachedCompletionItems: CompletionItem[] = [];

            for (const definition of this.library.values()) {
                cachedCompletionItems.push(Utils.libraryDefinitionToCompletionItem(definition));
            }

            this.cachedCompletionItems = cachedCompletionItems;
        }

        return this.cachedCompletionItems;
    }
}
