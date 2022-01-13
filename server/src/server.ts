// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

import { formatError } from "./errorUtils";
import { StandardLibraryUtils } from "./standardLibrary";

const LanguageId: string = "powerquery";

interface ServerSettings {
    checkForDuplicateIdentifiers: boolean;
    checkInvokeExpressions: boolean;
    locale: string;
    maintainWorkspaceCache: boolean;
}

const defaultServerSettings: ServerSettings = {
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: false,
    locale: PQP.DefaultLocale,
    maintainWorkspaceCache: true,
};

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);

let serverSettings: ServerSettings = defaultServerSettings;
let hasConfigurationCapability: boolean = false;

connection.onInitialize((params: LS.InitializeParams) => {
    const capabilities: LS.ServerCapabilities = {
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
    };

    hasConfigurationCapability = Boolean(params.capabilities.workspace?.configuration);

    return {
        capabilities,
    };
});

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        connection.client.register(LS.DidChangeConfigurationNotification.type, undefined);
    }

    serverSettings = await fetchConfigurationSettings();
});

connection.onDidChangeConfiguration(async () => {
    serverSettings = await fetchConfigurationSettings();
    documents.all().forEach(validateDocument);
});

documents.onDidClose((event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // Clear any errors associated with this file
    connection.sendDiagnostics({
        uri: event.document.uri,
        version: event.document.version,
        diagnostics: [],
    });
    PQLS.documentClosed(event.document);
});

documents.onDidChangeContent((event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // TODO: pass actual incremental changes into the workspace cache
    PQLS.documentClosed(event.document);

    validateDocument(event.document).catch((err: unknown) =>
        connection.console.error(`validateDocument err: ${formatError(assertAsError(err))}`),
    );
});

async function validateDocument(document: TextDocument): Promise<void> {
    const result: PQLS.ValidationResult = PQLS.validate(
        document,
        createValidationSettings(getLocalizedStandardLibrary()),
    );

    connection.sendDiagnostics({
        uri: document.uri,
        version: document.version,
        diagnostics: result.diagnostics,
    });
}

connection.onDocumentFormatting((documentfomattingParams: LS.DocumentFormattingParams): LS.TextEdit[] => {
    const maybeDocument: TextDocument | undefined = documents.get(documentfomattingParams.textDocument.uri);
    if (maybeDocument === undefined) {
        return [];
    }
    const document: TextDocument = maybeDocument;

    try {
        return PQLS.tryFormat(document, documentfomattingParams.options, serverSettings.locale);
    } catch (err) {
        const error: Error = err as Error;
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
        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position);

            return analysis.getAutocompleteItems().catch((err: unknown) => {
                connection.console.error(`onCompletion error ${formatError(assertAsError(err))}`);
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
        const document: TextDocument | undefined = documents.get(documentSymbolParams.textDocument.uri);
        if (document) {
            return PQLS.getDocumentSymbols(document, PQP.DefaultSettings, serverSettings.maintainWorkspaceCache);
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

        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document === undefined) {
            return emptyHover;
        }

        const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position);

        // eslint-disable-next-line @typescript-eslint/typedef
        return analysis.getHover().catch(err => {
            connection.console.error(`onHover error ${formatError(err)}`);
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
            activeParameter: null,
            activeSignature: 0,
        };

        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position);

            return analysis.getSignatureHelp().catch((err: unknown) => {
                connection.console.error(`onSignatureHelp error ${formatError(assertAsError(err))}`);
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

function createAnalysis(document: TextDocument, position: PQLS.Position): PQLS.Analysis {
    const localizedStandardLibrary: PQLS.Library.ILibrary = getLocalizedStandardLibrary();

    return PQLS.AnalysisUtils.createAnalysis(document, createAnalysisSettings(localizedStandardLibrary), position);
}

function createAnalysisSettings(library: PQLS.Library.ILibrary): PQLS.AnalysisSettings {
    return {
        createInspectionSettingsFn: () => createInspectionSettings(library),
        library,
        maintainWorkspaceCache: serverSettings.maintainWorkspaceCache,
    };
}

function getLocalizedStandardLibrary(): PQLS.Library.ILibrary {
    return StandardLibraryUtils.getOrCreateStandardLibrary(serverSettings.locale);
}

function createInspectionSettings(library: PQLS.Library.ILibrary): PQLS.InspectionSettings {
    return PQLS.InspectionUtils.createInspectionSettings(
        {
            ...PQP.DefaultSettings,
            locale: serverSettings.locale,
        },
        library.externalTypeResolver,
    );
}

function createValidationSettings(library: PQLS.Library.ILibrary): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library),
        LanguageId,
        serverSettings.checkForDuplicateIdentifiers,
        serverSettings.checkInvokeExpressions,
    );
}

async function fetchConfigurationSettings(): Promise<ServerSettings> {
    if (!hasConfigurationCapability) {
        return defaultServerSettings;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = await connection.workspace.getConfiguration({ section: "powerquery" });

    return {
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: config?.diagnostics?.experimental ?? false,
        locale: config?.general?.locale ?? PQP.DefaultLocale,
        maintainWorkspaceCache: true,
    };
}

function assertAsError<T>(value: T | Error): Error {
    if (value instanceof Error) {
        return value;
    }

    throw new Error(`received an error value that isn't an instanceof Error`);
}
