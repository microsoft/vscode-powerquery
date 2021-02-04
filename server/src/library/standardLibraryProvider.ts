// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import type { CompletionItem, Hover, SignatureHelp, SignatureInformation } from "vscode-languageserver-types";

import * as StandardLibraryUtils from "./standardLibraryUtils";

import { StandardLibrary } from "./standardLibrary";

export class StaticLibraryProvider implements PQLS.LibraryProvider {
    public readonly library: PQLS.Library.Library = StandardLibrary;
    private cachedCompletionItems: CompletionItem[] | undefined;

    // tslint:disable-next-line: no-empty
    constructor() {}

    public async getCompletionItems(context: PQLS.CompletionItemProviderContext): Promise<CompletionItem[]> {
        if (context.range) {
            return StandardLibraryUtils.cloneCompletionItemsWithRange(this.getCachedCompletionItems(), context.range);
        }

        return this.getCachedCompletionItems();
    }

    public async getHover(context: PQLS.HoverProviderContext): Promise<Hover | null> {
        const maybeDefinition: PQLS.Library.TLibraryDefinition | undefined = this.library.get(context.identifier);
        if (maybeDefinition === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        return StandardLibraryUtils.libraryDefinitionToHover(maybeDefinition, context.range);
    }

    public async getSignatureHelp(context: PQLS.SignatureProviderContext): Promise<SignatureHelp | null> {
        const maybeFunctionName: string | undefined = context.functionName;

        if (maybeFunctionName === undefined) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const maybeDefinition: PQLS.Library.TLibraryDefinition | undefined = this.library.get(maybeFunctionName);
        if (maybeDefinition?.kind !== PQLS.Library.LibraryDefinitionKind.Function) {
            // tslint:disable-next-line: no-null-keyword
            return null;
        }

        const signatures: SignatureInformation[] = StandardLibraryUtils.signatureInformation(maybeDefinition);

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
                cachedCompletionItems.push(StandardLibraryUtils.libraryDefinitionToCompletionItem(definition));
            }

            this.cachedCompletionItems = cachedCompletionItems;
        }

        return this.cachedCompletionItems;
    }
}
