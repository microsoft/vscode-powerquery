// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    CompletionItemProviderContext,
    HoverProviderContext,
    LibrarySymbolProvider,
    SignatureProviderContext,
} from "@microsoft/powerquery-language-services";
import { CompletionItem, Hover, SignatureHelp, SignatureInformation } from "vscode-languageserver-types";

import { AllModules, Library } from "./index";
import { LibraryDefinition } from "./jsonTypes";
import * as Utils from "./utils";

export function createLibraryProvider(): LibrarySymbolProvider {
    return new StaticLibrarySymbolProvider();
}

class StaticLibrarySymbolProvider implements LibrarySymbolProvider {
    private readonly activeLibrary: Library;
    private cachedCompletionItems: CompletionItem[] | undefined;

    constructor() {
        this.activeLibrary = AllModules;
    }

    public includeModules(_modules: string[]): void {
        throw new Error("Method not implemented.");
    }

    public async getCompletionItems(context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        if (context.range) {
            return Utils.cloneCompletionItemsWithRange(this.getCachedCompletionItems(), context.range);
        }

        return this.getCachedCompletionItems();
    }

    public async getHover(context: HoverProviderContext): Promise<Hover | null> {
        const definition: LibraryDefinition | undefined = this.activeLibrary.get(context.identifier);
        if (definition) {
            return Utils.libraryDefinitionToHover(definition, context.range);
        }

        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp | null> {
        const functionName: string | undefined = context.maybeFunctionName;
        if (functionName) {
            const definition: LibraryDefinition | undefined = this.activeLibrary.get(functionName);
            if (definition) {
                const signatures: SignatureInformation[] = Utils.signaturesToSignatureInformation(
                    definition.signatures,
                    definition.summary,
                );

                return {
                    signatures: signatures,
                    // tslint:disable-next-line: no-null-keyword
                    activeParameter: context.maybeArgumentOrdinal ? context.maybeArgumentOrdinal : null,
                    activeSignature: signatures.length - 1,
                };
            }
        }

        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    private getCachedCompletionItems(): CompletionItem[] {
        if (!this.cachedCompletionItems) {
            this.cachedCompletionItems = [];

            for (const definition of this.activeLibrary.values()) {
                const completionItem: CompletionItem = Utils.libraryDefinitionToCompletionItem(definition);
                this.cachedCompletionItems.push(completionItem);
            }
        }

        return this.cachedCompletionItems;
    }
}
