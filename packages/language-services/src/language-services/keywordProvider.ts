// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver-types";

import { CompletionItemProvider, CompletionItemProviderContext } from "./providers";

// TODO: Power Query parser defines constructor functions (ex. #table()) as keywords, but we want
// them to be treated like library functions instead.
const excludedKeywords: string[] = ["#binary", "#date", "#datetime", "#datetimezone", "#duration", "#table", "#time"];

export class KeywordProvider implements CompletionItemProvider {
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
}
