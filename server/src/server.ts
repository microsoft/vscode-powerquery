// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as LS from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getOrCreateStandardLibrary } from "./library";

const LanguageId: string = "powerquery";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);

let analysisOptions: PQLS.AnalysisOptions;

function createAnalysis(document: TextDocument, position: PQLS.Position): PQLS.Analysis {
    return PQLS.AnalysisUtils.createAnalysis(
        document,
        position,
        getOrCreateStandardLibrary(analysisOptions.locale),
        analysisOptions,
    );
}

connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: LS.TextDocumentSyncKind.Incremental,
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
    PQLS.documentClosed(event.document);
});

documents.onDidChangeContent(event => {
    // TODO: pass actual incremental changes into the workspace cache
    PQLS.documentClosed(event.document);

    validateDocument(event.document).catch(err =>
        connection.console.error(`validateDocument err: ${JSON.stringify(err, undefined, 4)}`),
    );
});

async function validateDocument(document: LS.TextDocument): Promise<void> {
    const result: PQLS.ValidationResult = PQLS.validate(document, {
        ...analysisOptions,
        checkForDuplicateIdentifiers: true,
        source: LanguageId,
    });

    connection.sendDiagnostics({
        uri: document.uri,
        diagnostics: result.diagnostics,
    });
}

connection.onDocumentFormatting((documentfomattingParams: LS.DocumentFormattingParams): LS.TextEdit[] => {
    const maybeDocument: LS.TextDocument | undefined = documents.get(documentfomattingParams.textDocument.uri);
    if (maybeDocument === undefined) {
        return [];
    }
    const document: LS.TextDocument = maybeDocument;

    try {
        return PQLS.tryFormat(document, documentfomattingParams.options, analysisOptions.locale ?? "en-US");
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
            const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position);

            return analysis.getAutocompleteItems().catch(err => {
                connection.console.error(`onCompletion error ${JSON.stringify(err, undefined, 4)}`);
                return [];
            });
        }

        return [];
    },
);

connection.onDocumentSymbol(
    async (
        documentSymbolParams: LS.DocumentSymbolParams,
        _token: LS.CancellationToken,
    ): Promise<LS.DocumentSymbol[] | undefined> => {
        const document: LS.TextDocument | undefined = documents.get(documentSymbolParams.textDocument.uri);
        if (document) {
            return PQLS.getDocumentSymbols(document, analysisOptions);
        }

        return undefined;
    },
);

connection.onHover(
    async (textDocumentPosition: LS.TextDocumentPositionParams, _token: LS.CancellationToken): Promise<LS.Hover> => {
        const emptyHover: LS.Hover = {
            range: undefined,
            contents: [],
        };

        const document: LS.TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document === undefined) {
            return emptyHover;
        }

        const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position);

        return analysis.getHover().catch(err => {
            connection.console.error(`onHover error ${JSON.stringify(err, undefined, 4)}`);
            return emptyHover;
        });
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
            const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position);

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
