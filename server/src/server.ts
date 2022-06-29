// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQF from "@microsoft/powerquery-formatter";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { DefinitionParams } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as ErrorUtils from "./errorUtils";
import * as TraceManagerUtils from "./traceManagerUtils";
import { ServerSettings, SettingsUtils } from "./settings.ts";
import { CancellationTokenUtils } from "./cancellationToken";
import { formatError } from "./errorUtils";

interface RenameIdentifierParams {
    readonly textDocumentUri: string;
    readonly position: LS.Position;
    readonly newName: string;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);

connection.onCompletion(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.CompletionItem[]> => {
        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);

        if (document) {
            const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
                textDocumentPosition.textDocument.uri,
                "onCompletion",
                textDocumentPosition.position,
            );

            const analysis: PQLS.Analysis = createAnalysis(
                document,
                textDocumentPosition.position,
                traceManager,
                cancellationToken,
            );

            try {
                return await analysis.getAutocompleteItems();
            } catch (error) {
                connection.console.error(`onCompletion error ${formatError(ErrorUtils.assertAsError(error))}`);

                return [];
            }
        }

        return [];
    },
);

connection.onDefinition(async (parameters: DefinitionParams, cancellationToken: LS.CancellationToken) => {
    const document: TextDocument | undefined = documents.get(parameters.textDocument.uri);

    if (document === undefined) {
        return undefined;
    }

    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
        parameters.textDocument.uri,
        "onDefinition",
        parameters.position,
    );

    const analysis: PQLS.Analysis = createAnalysis(document, parameters.position, traceManager, cancellationToken);

    try {
        return await analysis.getDefinition();
    } catch (error) {
        connection.console.error(`onDefinition error ${formatError(ErrorUtils.assertAsError(error))}`);

        return [];
    }
});

connection.onDidChangeConfiguration(async () => {
    await SettingsUtils.initializeServerSettings(connection);
    documents.all().forEach(validateDocument);
});

documents.onDidChangeContent(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // TODO: pass actual incremental changes into the workspace cache
    PQLS.documentClosed(event.document);

    try {
        return await validateDocument(event.document);
    } catch (error) {
        connection.console.error(`onCompletion error ${formatError(ErrorUtils.assertAsError(error))}`);

        return [];
    }
});

documents.onDidClose(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // Clear any errors associated with this file
    await connection.sendDiagnostics({
        uri: event.document.uri,
        version: event.document.version,
        diagnostics: [],
    });

    PQLS.documentClosed(event.document);
});

connection.onDocumentSymbol(
    async (
        documentSymbolParams: LS.DocumentSymbolParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.DocumentSymbol[] | undefined> => {
        const document: TextDocument | undefined = documents.get(documentSymbolParams.textDocument.uri);

        if (!document) {
            return undefined;
        }

        const serverSettings: ServerSettings = SettingsUtils.getServerSettings();

        return await PQLS.getDocumentSymbols(
            document,
            {
                ...PQP.DefaultSettings,
                maybeCancellationToken: CancellationTokenUtils.createAdapter(
                    cancellationToken,
                    serverSettings.timeoutInMs,
                ),
            },
            serverSettings.isWorkspaceCacheAllowed,
        );
    },
);

connection.onHover(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.Hover> => {
        const emptyHover: LS.Hover = {
            range: undefined,
            contents: [],
        };

        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);

        if (document === undefined) {
            return emptyHover;
        }

        const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
            textDocumentPosition.textDocument.uri,
            "onHover",
            textDocumentPosition.position,
        );

        const analysis: PQLS.Analysis = createAnalysis(
            document,
            textDocumentPosition.position,
            traceManager,
            cancellationToken,
        );

        try {
            return await analysis.getHover();
        } catch (error) {
            connection.console.error(`onHover error ${formatError(ErrorUtils.assertAsError(error))}`);

            return emptyHover;
        }
    },
);

connection.onInitialize((params: LS.InitializeParams) => {
    const capabilities: LS.ServerCapabilities = {
        completionProvider: {
            resolveProvider: false,
        },
        definitionProvider: true,
        documentFormattingProvider: true,
        documentSymbolProvider: {
            workDoneProgress: false,
        },
        hoverProvider: true,
        signatureHelpProvider: {
            triggerCharacters: ["(", ","],
        },
        textDocumentSync: LS.TextDocumentSyncKind.Incremental,
    };

    SettingsUtils.setHasConfigurationCapability(Boolean(params.capabilities.workspace?.configuration));

    return {
        capabilities,
    };
});

connection.onInitialized(async () => {
    if (SettingsUtils.getHasConfigurationCapability()) {
        await connection.client.register(LS.DidChangeConfigurationNotification.type, undefined);
    }

    await SettingsUtils.initializeServerSettings(connection);
});

connection.onRequest("powerquery/renameIdentifier", async (params: RenameIdentifierParams) => {
    const document: TextDocument | undefined = documents.get(params.textDocumentUri);

    if (document === undefined) {
        return undefined;
    }

    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "renameIdentifier");
    const analysis: PQLS.Analysis = createAnalysis(document, params.position, traceManager, undefined);

    try {
        return await analysis.getRenameEdits(params.newName);
    } catch (error) {
        connection.console.error(
            `on powerquery/renameIdentifier error ${formatError(ErrorUtils.assertAsError(error))}`,
        );

        return [];
    }
});

connection.onSignatureHelp(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.SignatureHelp> => {
        const emptySignatureHelp: LS.SignatureHelp = {
            signatures: [],
            activeParameter: undefined,
            activeSignature: 0,
        };

        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);

        if (document) {
            const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
                textDocumentPosition.textDocument.uri,
                "onSignatureHelp",
                textDocumentPosition.position,
            );

            const analysis: PQLS.Analysis = createAnalysis(
                document,
                textDocumentPosition.position,
                traceManager,
                cancellationToken,
            );

            try {
                return await analysis.getSignatureHelp();
            } catch (error) {
                connection.console.error(`onSignatureHelp error ${formatError(ErrorUtils.assertAsError(error))}`);

                return emptySignatureHelp;
            }
        }

        return emptySignatureHelp;
    },
);

connection.onDocumentFormatting(
    async (
        documentfomattingParams: LS.DocumentFormattingParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.TextEdit[]> => {
        const maybeDocument: TextDocument | undefined = documents.get(documentfomattingParams.textDocument.uri);

        if (maybeDocument === undefined) {
            return [];
        }

        const document: TextDocument = maybeDocument;
        const serverSettings: ServerSettings = SettingsUtils.getServerSettings();
        const experimental: boolean = serverSettings.experimental;

        try {
            return await PQLS.tryFormat(
                document,
                {
                    ...PQP.DefaultSettings,
                    indentationLiteral: PQF.IndentationLiteral.SpaceX4,
                    newlineLiteral: PQF.NewlineLiteral.Windows,
                    maybeCancellationToken: CancellationTokenUtils.createAdapter(
                        cancellationToken,
                        serverSettings.timeoutInMs,
                    ),
                    maxWidth: experimental ? 120 : undefined,
                },
                experimental,
            );
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
    traceManager: PQP.Trace.TraceManager,
    cancellationToken: LS.CancellationToken | undefined,
): PQLS.Analysis {
    const localizedLibrary: PQLS.Library.ILibrary = SettingsUtils.getLocalizedLibrary();
    document.uri;

    return PQLS.AnalysisUtils.createAnalysis(
        document,
        SettingsUtils.createAnalysisSettings(localizedLibrary, traceManager, cancellationToken),
        position,
    );
}

async function validateDocument(document: TextDocument): Promise<void> {
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "validateDocument");

    const result: PQLS.ValidationResult = await PQLS.validate(
        document,
        SettingsUtils.createValidationSettings(SettingsUtils.getLocalizedLibrary(), traceManager, undefined),
    );

    await connection.sendDiagnostics({
        uri: document.uri,
        version: document.version,
        diagnostics: result.diagnostics,
    });
}
