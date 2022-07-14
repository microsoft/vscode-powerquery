// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQF from "@microsoft/powerquery-formatter";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { DefinitionParams, RenameParams } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as ErrorUtils from "./errorUtils";
import * as TraceManagerUtils from "./traceManagerUtils";
import { LibraryJson, ModuleLibraries } from "./library";
import { ServerSettings, SettingsUtils } from "./settings.ts";
import { CancellationTokenUtils } from "./cancellationToken";
import { getLocalizedModuleLibraryFromTextDocument } from "./settings.ts/settingsUtils";

interface SemanticTokenParams {
    readonly textDocumentUri: string;
    readonly cancellationToken: LS.CancellationToken;
}

interface ModuleLibraryUpdatedParams {
    readonly workspaceUriPath: string;
    readonly library: LibraryJson;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);
const moduleLibraries: ModuleLibraries = new ModuleLibraries();

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
                ErrorUtils.handleError(connection, error, "onComplection");

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
        connection.console.error(`onDefinition error ${ErrorUtils.handleError(connection, error, "onDefinition")}`);

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
        connection.console.error(
            `onCompletion error ${ErrorUtils.handleError(connection, error, "onDidContentChange")}`,
        );

        return [];
    }
});

documents.onDidClose(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // remove the document from module library container and we no longer need to trace it
    moduleLibraries.removeOneTextDocument(event.document);

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
                    serverSettings.globalTimeoutInMs,
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
            ErrorUtils.handleError(connection, error, "onHover");

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
        renameProvider: true,
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

connection.onRenameRequest(async (params: RenameParams, cancellationToken: LS.CancellationToken) => {
    const document: TextDocument | undefined = documents.get(params.textDocument.uri.toString());

    if (document === undefined) {
        return undefined;
    }

    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "renameIdentifier");
    const analysis: PQLS.Analysis = createAnalysis(document, params.position, traceManager, cancellationToken);

    try {
        return {
            changes: { [params.textDocument.uri.toString()]: await analysis.getRenameEdits(params.newName) },
        };
    } catch (error) {
        ErrorUtils.handleError(connection, error, "onRenameRequest");

        return {};
    }
});

connection.onRequest("powerquery/semanticTokens", async (params: SemanticTokenParams) => {
    const document: TextDocument | undefined = documents.get(params.textDocumentUri);

    if (document === undefined) {
        return [];
    }

    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "semanticTokens");

    const analysis: PQLS.Analysis = createAnalysis(
        document,
        // We need to provide a Position but in this case we don't really care about that
        { character: 0, line: 0 },
        traceManager,
        params.cancellationToken,
    );

    return await analysis.getPartialSemanticTokens();
});

connection.onRequest("powerquery/moduleLibraryUpdated", (params: ModuleLibraryUpdatedParams): void => {
    const allTextDocuments: TextDocument[] = moduleLibraries.addOneModuleLibrary(
        params.workspaceUriPath,
        params.library,
    );

    // need to validate those currently opened documents
    void Promise.all(allTextDocuments.map(validateDocument));
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
                ErrorUtils.handleError(connection, error, "onSignatureHelp");

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
                        serverSettings.globalTimeoutInMs,
                    ),
                    maxWidth: experimental ? 120 : undefined,
                },
                experimental,
            );
        } catch (error) {
            ErrorUtils.handleError(connection, error, "onDocumentFormatting");

            return [];
        }
    },
);

// The onChange event doesn't include a cancellation token, so we have to manage them ourselves,
// done by keeping a Map<uri, existing cancellation token for uri>.
// Whenever a new validation attempt begins we check if an existing token for the uri exists and cancels it.
// Then we store ValidationSettings.maybeCancellationToken for the uri if one exists.
const onValidateCancellationTokens: Map<string, PQP.ICancellationToken> = new Map();

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
    const localizedLibrary: PQLS.Library.ILibrary = getLocalizedModuleLibraryFromTextDocument(
        moduleLibraries,
        document,
    );

    return PQLS.AnalysisUtils.createAnalysis(
        document,
        SettingsUtils.createAnalysisSettings(localizedLibrary, traceManager, cancellationToken),
        position,
    );
}

async function validateDocument(document: TextDocument): Promise<void> {
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "validateDocument");

    const localizedLibrary: PQLS.Library.ILibrary = getLocalizedModuleLibraryFromTextDocument(
        moduleLibraries,
        document,
        true,
    );

    const validationSettings: PQLS.ValidationSettings = SettingsUtils.createValidationSettings(
        localizedLibrary,
        traceManager,
        undefined,
    );

    const uri: string = document.uri.toString();
    const existingCancellationToken: PQP.ICancellationToken | undefined = onValidateCancellationTokens.get(uri);

    if (existingCancellationToken !== undefined) {
        existingCancellationToken.cancel();
        onValidateCancellationTokens.delete(uri);
    }

    const maybeNewCancellationToken: PQP.ICancellationToken | undefined = validationSettings.maybeCancellationToken;

    if (maybeNewCancellationToken !== undefined) {
        onValidateCancellationTokens.set(uri, maybeNewCancellationToken);
    }

    try {
        const result: PQLS.ValidationResult = await PQLS.validate(document, validationSettings);

        await connection.sendDiagnostics({
            uri: document.uri,
            version: document.version,
            diagnostics: result.diagnostics,
        });
    } catch (error) {
        ErrorUtils.handleError(connection, error, "validateDocument");
    }
}
