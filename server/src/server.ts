// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import * as LS from "vscode-languageserver/node";

import { CancellationTokenShimUtils } from "./cancellationTokenShim";

import { TextDocument } from "vscode-languageserver-textdocument";

import { StandardLibraryUtils } from "./standardLibrary";

const LanguageId: string = "powerquery";

interface ServerSettings {
    checkForDuplicateIdentifiers: boolean;
    checkInvokeExpressions: boolean;
    locale: string;
    maintainWorkspaceCache: boolean;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);

let serverSettings: ServerSettings;
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

    hasConfigurationCapability = !!params.capabilities.workspace?.configuration;

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

documents.onDidClose(event => {
    // Clear any errors associated with this file
    connection.sendDiagnostics({
        uri: event.document.uri,
        version: event.document.version,
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

async function validateDocument(document: TextDocument): Promise<void> {
    const result: PQLS.ValidationResult = PQLS.validate(
        document,
        createValidationSettings(getLocalizedStandardLibrary(), undefined),
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
        return PQLS.tryFormat(document, documentfomattingParams.options, serverSettings.locale ?? PQP.DefaultLocale);
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
        token: LS.CancellationToken,
    ): Promise<LS.CompletionItem[]> => {
        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: PQLS.Analysis = createAnalysis(
                document,
                textDocumentPosition.position,
                CancellationTokenShimUtils.create(connection.onHover.name, document, token),
            );

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
        const document: TextDocument | undefined = documents.get(documentSymbolParams.textDocument.uri);
        if (document) {
            return PQLS.getDocumentSymbols(
                document,
                PQP.DefaultSettings,
                serverSettings.maintainWorkspaceCache ?? false,
            );
        }

        return undefined;
    },
);

connection.onHover(
    async (textDocumentPosition: LS.TextDocumentPositionParams, token: LS.CancellationToken): Promise<LS.Hover> => {
        const emptyHover: LS.Hover = {
            range: undefined,
            contents: [],
        };

        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document === undefined) {
            return emptyHover;
        }

        const analysis: PQLS.Analysis = createAnalysis(
            document,
            textDocumentPosition.position,
            CancellationTokenShimUtils.create(connection.onHover.name, document, token),
        );

        return analysis.getHover().catch(err => {
            connection.console.error(`onHover error ${JSON.stringify(err, undefined, 4)}`);
            return emptyHover;
        });
    },
);

connection.onSignatureHelp(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        token: LS.CancellationToken,
    ): Promise<LS.SignatureHelp> => {
        const emptySignatureHelp: LS.SignatureHelp = {
            signatures: [],
            // tslint:disable-next-line: no-null-keyword
            activeParameter: null,
            activeSignature: 0,
        };

        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            const analysis: PQLS.Analysis = createAnalysis(
                document,
                textDocumentPosition.position,
                CancellationTokenShimUtils.create(connection.onHover.name, document, token),
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

function createAnalysis(
    document: TextDocument,
    position: PQLS.Position,
    maybeCancellationToken: PQP.ICancellationToken | undefined,
): PQLS.Analysis {
    const localizedStandardLibrary: PQLS.Library.ILibrary = getLocalizedStandardLibrary();

    return PQLS.AnalysisUtils.createAnalysis(
        document,
        createAnalysisSettings(localizedStandardLibrary, maybeCancellationToken),
        position,
    );
}

function createAnalysisSettings(
    library: PQLS.Library.ILibrary,
    maybeCancellationToken: PQP.ICancellationToken | undefined,
): PQLS.AnalysisSettings {
    return {
        createInspectionSettingsFn: () => createInspectionSettings(library, maybeCancellationToken),
        library,
        maintainWorkspaceCache: serverSettings.maintainWorkspaceCache,
    };
}

function createInspectionSettings(
    library: PQLS.Library.ILibrary,
    maybeCancellationToken: PQP.ICancellationToken | undefined,
): PQLS.InspectionSettings {
    return PQLS.InspectionUtils.createInspectionSettings(
        {
            ...PQP.DefaultSettings,
            locale: serverSettings.locale,
            maybeCancellationToken,
        },
        library.externalTypeResolver,
    );
}

function createValidationSettings(
    library: PQLS.Library.ILibrary,
    maybeCancellationToken: PQP.ICancellationToken | undefined,
): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library, maybeCancellationToken),
        LanguageId,
        serverSettings.checkForDuplicateIdentifiers,
    );
}

async function fetchConfigurationSettings(): Promise<ServerSettings> {
    if (!hasConfigurationCapability) {
        return {
            checkForDuplicateIdentifiers: true,
            checkInvokeExpressions: false,
            locale: PQP.DefaultLocale,
            maintainWorkspaceCache: true,
        };
    }

    const config: any = await connection.workspace.getConfiguration({ section: "powerquery" });
    return {
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: config?.diagnostics?.experimental ?? false,
        locale: config?.general?.locale ?? PQP.DefaultLocale,
        maintainWorkspaceCache: true,
    };
}

function getLocalizedStandardLibrary(): PQLS.Library.ILibrary {
    return StandardLibraryUtils.getOrCreateStandardLibrary(serverSettings.locale);
}
