// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, Hover, SignatureHelp, CompletionItemKind } from "vscode-languageserver-types";

import * as Common from "./common";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    SignatureProviderContext,
    SymbolProvider,
} from "./symbolProviders";

// TODO: Power Query parser defines constructor functions (ex. #table()) as keywords, but we want
// them to be treated like library functions instead.
const excludedKeywords: string[] = ["#binary", "#date", "#datetime", "#datetimezone", "#duration", "#table", "#time"];

export class KeywordProvider implements SymbolProvider {
    private readonly keywordCompletionItems: CompletionItem[] = [];

    constructor() {
        PQP.Keywords.forEach(keyword => {
            if (!excludedKeywords.includes(keyword)) {
                this.keywordCompletionItems.push({
                    kind: CompletionItemKind.Keyword,
                    label: keyword,
                });
            }
        });
    }

    // TODO: context sensitive keywords (closing "in" for "let", "otherwise" for "try", etc...)
    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return this.keywordCompletionItems;
    }

    public async getHover(_identifier: string, _context: HoverProviderContext): Promise<Hover | null> {
        return Common.EmptyHover;
    }

    public async getSignatureHelp(
        _functionName: string,
        _context: SignatureProviderContext,
    ): Promise<SignatureHelp | null> {
        return null;
    }
}
