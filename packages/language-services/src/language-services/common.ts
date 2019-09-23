// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItem, Hover, SignatureHelp } from "vscode-languageserver-types";

export const EmptyCompletionItems: CompletionItem[] = [];

export const EmptyHover: Hover = {
    range: undefined,
    contents: [],
};

export const EmptySignatureHelp: SignatureHelp = {
    signatures: [],
    activeParameter: null,
    activeSignature: 0,
};