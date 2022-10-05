// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as vscode from "vscode";

import * as FuncUtils from "../funcUtils";
import { CancellationToken, TextDocument } from "vscode";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageclient/node";

export function createDocumentSemanticTokensProvider(client: LC.LanguageClient): vscode.DocumentSemanticTokensProvider {
    return {
        provideDocumentSemanticTokens: (
            textDocument: TextDocument,
            cancellationToken: CancellationToken,
        ): Promise<vscode.SemanticTokens> => debouncedSemanticTokenRequester(client, textDocument, cancellationToken),
    };
}

const semanticTokenTypes: SemanticTokenTypes[] = [
    SemanticTokenTypes.function,
    SemanticTokenTypes.keyword,
    SemanticTokenTypes.number,
    SemanticTokenTypes.operator,
    SemanticTokenTypes.parameter,
    SemanticTokenTypes.string,
    SemanticTokenTypes.type,
    SemanticTokenTypes.variable,
];

const semanticTokenModifiers: SemanticTokenModifiers[] = [
    SemanticTokenModifiers.declaration,
    SemanticTokenModifiers.defaultLibrary,
];

export const SemanticTokensLegend: vscode.SemanticTokensLegend = new vscode.SemanticTokensLegend(
    semanticTokenTypes,
    semanticTokenModifiers,
);

const debouncedSemanticTokenRequester: (
    this: unknown,
    client: LC.LanguageClient,
    textDocument: TextDocument,
    cancellationToken: CancellationToken,
) => Promise<vscode.SemanticTokens> = FuncUtils.partitionFn(
    () => FuncUtils.debounce(semanticTokenRequester, 250),
    (_client: LC.LanguageClient, textDocument: TextDocument, _cancellationToken: CancellationToken) =>
        textDocument.uri.toString(),
);

async function semanticTokenRequester(
    client: LC.LanguageClient,
    textDocument: TextDocument,
    cancellationToken: CancellationToken,
): Promise<vscode.SemanticTokens> {
    const semanticTokens: PQLS.PartialSemanticToken[] = await client.sendRequest<PQLS.PartialSemanticToken[]>(
        "powerquery/semanticTokens",
        {
            textDocumentUri: textDocument.uri.toString(),
            cancellationToken,
        },
    );

    const tokenBuilder: vscode.SemanticTokensBuilder = new vscode.SemanticTokensBuilder(SemanticTokensLegend);

    for (const partialSemanticToken of semanticTokens) {
        tokenBuilder.push(
            new vscode.Range(
                new vscode.Position(partialSemanticToken.range.start.line, partialSemanticToken.range.start.character),
                new vscode.Position(partialSemanticToken.range.end.line, partialSemanticToken.range.end.character),
            ),
            partialSemanticToken.tokenType,
            partialSemanticToken.tokenModifiers,
        );
    }

    return tokenBuilder.build();
}
