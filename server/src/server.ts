// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// import {
//     format,
//     FormatError,
//     FormatSettings,
//     IndentationLiteral,
//     NewlineLiteral,
//     Result,
//     ResultKind,
// } from "@microsoft/powerquery-format";
import * as LanguageServices from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { Library } from ".";
import { DefaultSettings } from "@microsoft/powerquery-parser";
import * as LS from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

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

documents.onDidClose((event) => {
    LanguageServices.documentClosed(event.document);
});

// TODO: Support incremental lexing.
// TextDocuments uses the connection's onDidChangeTextDocument, and I can't see a way to provide a second
// one to intercept incremental changes. TextDocuments.OnDidChangeContent only provides the full document.
documents.onDidChangeContent((event) => {
    LanguageServices.documentUpdated(event.document);

    validateDocument(event.document).catch((err) =>
        connection.console.error(`validateDocument err: ${JSON.stringify(err, undefined, 4)}`),
    );
});

async function validateDocument(document: LS.TextDocument): Promise<void> {
    const validationResult: LanguageServices.ValidationResult = LanguageServices.validate(document);

    connection.sendDiagnostics({
        uri: document.uri,
        diagnostics: validationResult.diagnostics,
    });
}

connection.onDocumentFormatting((documentfomattingParams: LS.DocumentFormattingParams): LS.TextEdit[] => {
    const maybeDocument: undefined | LS.TextDocument = documents.get(documentfomattingParams.textDocument.uri);
    if (maybeDocument === undefined) {
        return [];
    }
    const document: LS.TextDocument = maybeDocument;

    const options: LS.FormattingOptions = documentfomattingParams.options;
    const textEditResult: LS.TextEdit[] = [];

    let indentationLiteral: LanguageServices.IndentationLiteral;
    if (options.insertSpaces) {
        indentationLiteral = LanguageServices.IndentationLiteral.SpaceX4;
    } else {
        indentationLiteral = LanguageServices.IndentationLiteral.Tab;
    }

    const formatSettings: LanguageServices.FormatSettings = {
        // TODO (Localization): update settings based on locale
        ...DefaultSettings,
        indentationLiteral,
        // TODO: get the newline terminator for the document/workspace
        newlineLiteral: LanguageServices.NewlineLiteral.Windows,
    };

    const formatResult: LanguageServices.TriedFormat = LanguageServices.tryFormat(formatSettings, document.getText());
    if (PQP.ResultUtils.isOk(formatResult)) {
        textEditResult.push(LS.TextEdit.replace(fullDocumentRange(document), formatResult.value));
    } else {
        // TODO: should this go in the failed promise path?
        const error: LanguageServices.FormatError.TFormatError = formatResult.error;
        let message: string;
        if (LanguageServices.FormatError.isTFormatError(error)) {
            message = error.innerError.message;
        } else {
            message = "An unknown error occured during formatting.";
        }

        connection.window.showErrorMessage(message);
    }

    return textEditResult;
});

// TODO: is there a better way to do this?
function fullDocumentRange(document: LS.TextDocument): LS.Range {
    return {
        start: document.positionAt(0),
        end: {
            line: document.lineCount - 1,
            character: Number.MAX_VALUE,
        },
    };
}

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

            return analysis.getCompletionItems().catch((err) => {
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

            return analysis.getHover().catch((err) => {
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

            return analysis.getSignatureHelp().catch((err) => {
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
