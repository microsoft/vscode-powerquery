// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LanguageServices from "@microsoft/powerquery-language-services";
import * as LS from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Library } from ".";

const LanguageId: string = "powerquery";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);

const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);

let analysisOptions: LanguageServices.AnalysisOptions;

connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: LS.TextDocumentSyncKind.Incremental,
            documentFormattingProvider: true,
            completionProvider: {
                // TODO: is it better to return the first pass without documention to reduce message size?
                resolveProvider: false,
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["(", ","],
            },
        },
    };
});

connection.onInitialized(() => {
    analysisOptions = {
        librarySymbolProvider: Library.createLibraryProvider(),
    };
});

documents.onDidClose(event => {
    LanguageServices.documentClosed(event.document);
});

connection.onDidChangeTextDocument(event => {
    const document: LS.TextDocument | undefined = documents.get(event.textDocument.uri);
    if (document === undefined || document.languageId !== LanguageId) {
        return;
    }

    // TODO: Language Services library updates to better support this event.
    const version: number = event.textDocument.version ?? 0;

    LanguageServices.documentUpdated(document, event.contentChanges, version);
});

documents.onDidChangeContent(event => {
    validateDocument(event.document).catch(err =>
        connection.console.error(`validateDocument err: ${JSON.stringify(err, undefined, 4)}`),
    );
});

async function validateDocument(document: LS.TextDocument): Promise<void> {
    const diagnostics: LS.Diagnostic[] = LanguageServices.validate(document);

    connection.sendDiagnostics({
        uri: document.uri,
        diagnostics,
    });
}

connection.onDocumentFormatting((documentfomattingParams: LS.DocumentFormattingParams): LS.TextEdit[] => {
    const maybeDocument: LS.TextDocument | undefined = documents.get(documentfomattingParams.textDocument.uri);
    if (maybeDocument === undefined) {
        return [];
    }
    const document: LS.TextDocument = maybeDocument;

    try {
        return LanguageServices.tryFormat(
            document,
            documentfomattingParams.options,
            // TODO: find a way to query for a user's current localization
            "en-US",
        );
    } catch (err) {
        const error: Error = err;
        const errorMessage: string = error.message;

        let userMessage: string;
        // An already localized message was returned.
        if (errorMessage) {
            userMessage = errorMessage;
        } else {
            userMessage = "An unknown error occured during formatting.";
        }

        connection.window.showErrorMessage(userMessage);
        return [];
    }
});

connection.onCompletion(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        _token: LS.CancellationToken,
    ): Promise<LS.CompletionItem[]> => {
        const document: LS.TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: LanguageServices.Analysis = LanguageServices.createAnalysisSession(
                document,
                textDocumentPosition.position,
                analysisOptions,
            );

            return analysis.getCompletionItems().catch(err => {
                connection.console.error(`onCompletion error ${JSON.stringify(err, undefined, 4)}`);
                return [];
            });
        }

        return [];
    },
);

connection.onHover(
    async (textDocumentPosition: LS.TextDocumentPositionParams, _token: LS.CancellationToken): Promise<LS.Hover> => {
        const emptyHover: LS.Hover = {
            range: undefined,
            contents: [],
        };

        const document: LS.TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: LanguageServices.Analysis = LanguageServices.createAnalysisSession(
                document,
                textDocumentPosition.position,
                analysisOptions,
            );

            return analysis.getHover().catch(err => {
                connection.console.error(`onHover error ${JSON.stringify(err, undefined, 4)}`);
                return emptyHover;
            });
        }

        return emptyHover;
    },
);

connection.onSignatureHelp(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        _token: LS.CancellationToken,
    ): Promise<LS.SignatureHelp> => {
        const emptySignatureHelp: LS.SignatureHelp = {
            signatures: [],
            // tslint:disable-next-line: no-null-keyword
            activeParameter: null,
            activeSignature: 0,
        };

        const document: LS.TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: LanguageServices.Analysis = LanguageServices.createAnalysisSession(
                document,
                textDocumentPosition.position,
                analysisOptions,
            );

            return analysis.getSignatureHelp().catch(err => {
                connection.console.error(`onSignatureHelp error ${JSON.stringify(err, undefined, 4)}`);
                return emptySignatureHelp;
            });
        }

        return emptySignatureHelp;
    },
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
