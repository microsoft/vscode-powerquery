// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PowerQueryLanguageServices from "@microsoft/powerquery-language-services";
import * as LanguageServices from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Library } from ".";

const LanguageId: string = "powerquery";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LanguageServices.Connection = LanguageServices.createConnection(
    LanguageServices.ProposedFeatures.all,
);
const documents: LanguageServices.TextDocuments<TextDocument> = new LanguageServices.TextDocuments(TextDocument);

let analysisOptions: PowerQueryLanguageServices.AnalysisOptions;

connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: LanguageServices.TextDocumentSyncKind.Incremental,
            documentFormattingProvider: true,
            completionProvider: {
                resolveProvider: false,
            },
            documentSymbolProvider: {
                workDoneProgress: false,
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["(", ","],
            },
        },
    };
});

connection.onInitialized(() => {
    connection.workspace.getConfiguration({ section: "powerquery" }).then(config => {
        analysisOptions = {
            locale: config?.general?.locale,
            librarySymbolProvider: Library.createLibraryProvider(),
            maintainWorkspaceCache: true,
        };
    });
});

documents.onDidClose(event => {
    // Clear any errors associated with this file
    connection.sendDiagnostics({
        uri: event.document.uri,
        diagnostics: [],
    });
    PowerQueryLanguageServices.documentClosed(event.document);
});

documents.onDidChangeContent(event => {
    // TODO: pass actual incremental changes into the workspace cache
    PowerQueryLanguageServices.documentClosed(event.document);

    validateDocument(event.document).catch(err =>
        connection.console.error(`validateDocument err: ${JSON.stringify(err, undefined, 4)}`),
    );
});

async function validateDocument(document: LanguageServices.TextDocument): Promise<void> {
    const result: PowerQueryLanguageServices.ValidationResult = PowerQueryLanguageServices.validate(document, {
        ...analysisOptions,
        checkForDuplicateIdentifiers: true,
        source: LanguageId,
    });

    connection.sendDiagnostics({
        uri: document.uri,
        diagnostics: result.diagnostics,
    });
}

connection.onDocumentFormatting(
    (documentfomattingParams: LanguageServices.DocumentFormattingParams): LanguageServices.TextEdit[] => {
        const maybeDocument: LanguageServices.TextDocument | undefined = documents.get(
            documentfomattingParams.textDocument.uri,
        );
        if (maybeDocument === undefined) {
            return [];
        }
        const document: LanguageServices.TextDocument = maybeDocument;

        try {
            return PowerQueryLanguageServices.tryFormat(
                document,
                documentfomattingParams.options,
                analysisOptions.locale ?? "en-US",
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
    },
);

connection.onCompletion(
    async (
        textDocumentPosition: LanguageServices.TextDocumentPositionParams,
        _token: LanguageServices.CancellationToken,
    ): Promise<LanguageServices.CompletionItem[]> => {
        const document: LanguageServices.TextDocument | undefined = documents.get(
            textDocumentPosition.textDocument.uri,
        );
        if (document) {
            const analysis: PowerQueryLanguageServices.Analysis = PowerQueryLanguageServices.AnalysisUtils.createAnalysis(
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

connection.onDocumentSymbol(
    async (
        documentSymbolParams: LanguageServices.DocumentSymbolParams,
        _token: LanguageServices.CancellationToken,
    ): Promise<LanguageServices.DocumentSymbol[] | undefined> => {
        const document: LanguageServices.TextDocument | undefined = documents.get(
            documentSymbolParams.textDocument.uri,
        );
        if (document) {
            return PowerQueryLanguageServices.getDocumentSymbols(document, analysisOptions);
        }

        return undefined;
    },
);

connection.onHover(
    async (
        textDocumentPosition: LanguageServices.TextDocumentPositionParams,
        _token: LanguageServices.CancellationToken,
    ): Promise<LanguageServices.Hover> => {
        const emptyHover: LanguageServices.Hover = {
            range: undefined,
            contents: [],
        };

        const document: LanguageServices.TextDocument | undefined = documents.get(
            textDocumentPosition.textDocument.uri,
        );
        if (document === undefined) {
            return emptyHover;
        }

        const analysis: PowerQueryLanguageServices.Analysis = PowerQueryLanguageServices.AnalysisUtils.createAnalysis(
            document,
            textDocumentPosition.position,
            analysisOptions,
        );

        return analysis.getHover().catch(err => {
            connection.console.error(`onHover error ${JSON.stringify(err, undefined, 4)}`);
            return emptyHover;
        });
    },
);

connection.onSignatureHelp(
    async (
        textDocumentPosition: LanguageServices.TextDocumentPositionParams,
        _token: LanguageServices.CancellationToken,
    ): Promise<LanguageServices.SignatureHelp> => {
        const emptySignatureHelp: LanguageServices.SignatureHelp = {
            signatures: [],
            // tslint:disable-next-line: no-null-keyword
            activeParameter: null,
            activeSignature: 0,
        };

        const document: LanguageServices.TextDocument | undefined = documents.get(
            textDocumentPosition.textDocument.uri,
        );
        if (document) {
            const analysis: PowerQueryLanguageServices.Analysis = PowerQueryLanguageServices.AnalysisUtils.createAnalysis(
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
