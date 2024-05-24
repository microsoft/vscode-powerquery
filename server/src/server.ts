// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQF from "@microsoft/powerquery-formatter";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as ErrorUtils from "./errorUtils";
import * as EventHandlerUtils from "./eventHandlerUtils";
import * as TraceManagerUtils from "./traceManagerUtils";
import { ExternalLibraryUtils, LibraryUtils, ModuleLibraryUtils } from "./library";
import { SettingsUtils } from "./settings";

type LibraryJson = ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;

interface SemanticTokenParams {
    readonly textDocumentUri: string;
    readonly cancellationToken: LS.CancellationToken;
}

interface ModuleLibraryUpdatedParams {
    readonly workspaceUriPath: string;
    readonly library: LibraryJson;
}

interface SetLibrarySymbolsParams {
    librarySymbols: ReadonlyArray<[string, LibraryJson | null]>;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);

connection.onCompletion(
    async (
        params: LS.TextDocumentPositionParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.CompletionItem[]> => {
        const document: TextDocument | undefined = documents.get(params.textDocument.uri);

        if (document === undefined) {
            return [];
        }

        const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);

        const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
            params.textDocument.uri,
            "onCompletion",
            params.position,
        );

        const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

        const result: PQP.Result<PQLS.Inspection.AutocompleteItem[] | undefined, PQP.CommonError.CommonError> =
            await analysis.getAutocompleteItems(params.position, pqpCancellationToken);

        if (PQP.ResultUtils.isOk(result)) {
            return result.value ?? [];
        } else {
            ErrorUtils.handleError(connection, result.error, "onCompletion", traceManager);

            return [];
        }
    },
);

connection.onDefinition(async (params: LS.DefinitionParams, cancellationToken: LS.CancellationToken) => {
    const document: TextDocument | undefined = documents.get(params.textDocument.uri);

    if (document === undefined) {
        return undefined;
    }

    const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);

    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
        params.textDocument.uri,
        "onDefinition",
        params.position,
    );

    const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

    const result: PQP.Result<LS.Location[] | undefined, PQP.CommonError.CommonError> = await analysis.getDefinition(
        params.position,
        pqpCancellationToken,
    );

    if (PQP.ResultUtils.isOk(result)) {
        return result.value ?? [];
    } else {
        ErrorUtils.handleError(connection, result.error, "onComplection", traceManager);

        return [];
    }
});

connection.onDidChangeConfiguration(async () => {
    await SettingsUtils.initializeServerSettings(connection);
    connection.languages.diagnostics.refresh();
});

documents.onDidClose(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // Clear any errors associated with this file
    await connection.sendDiagnostics({
        uri: event.document.uri,
        version: event.document.version,
        diagnostics: [],
    });
});

connection.onFoldingRanges(async (params: LS.FoldingRangeParams, cancellationToken: LS.CancellationToken) => {
    const document: TextDocument | undefined = documents.get(params.textDocument.uri);

    if (document === undefined) {
        return [];
    }

    const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "onFoldingRanges");
    const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

    const result: PQP.Result<LS.FoldingRange[] | undefined, PQP.CommonError.CommonError> =
        await analysis.getFoldingRanges(pqpCancellationToken);

    if (PQP.ResultUtils.isOk(result)) {
        return result.value ?? [];
    } else {
        ErrorUtils.handleError(connection, result.error, "onFoldingRanges", traceManager);

        return [];
    }
});

connection.onDocumentSymbol(documentSymbols);

const emptyHover: LS.Hover = {
    range: undefined,
    contents: [],
};

// eslint-disable-next-line require-await
connection.onHover(async (params: LS.TextDocumentPositionParams, cancellationToken: LS.CancellationToken) =>
    EventHandlerUtils.runSafeAsync(
        async () => {
            const document: TextDocument | undefined = documents.get(params.textDocument.uri);

            if (document === undefined) {
                return emptyHover;
            }

            const pqpCancellationToken: PQP.ICancellationToken =
                SettingsUtils.createCancellationToken(cancellationToken);

            const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
                params.textDocument.uri,
                "onHover",
                params.position,
            );

            const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

            const result: PQP.Result<LS.Hover | undefined, PQP.CommonError.CommonError> = await analysis.getHover(
                params.position,
                pqpCancellationToken,
            );

            if (PQP.ResultUtils.isOk(result)) {
                return result.value ?? emptyHover;
            } else {
                ErrorUtils.handleError(connection, result.error, "onHover", traceManager);

                return emptyHover;
            }
        },
        emptyHover,
        `Error while computing hover for ${params.textDocument.uri}`,
        cancellationToken,
    ),
);

connection.onInitialize((params: LS.InitializeParams) => {
    const capabilities: LS.ServerCapabilities = {
        completionProvider: {
            resolveProvider: false,
        },
        definitionProvider: true,
        diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false,
        },
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
        workspace: {
            // TODO: Disabling until we've fully tested support for multiple workspace folders
            workspaceFolders: {
                supported: false,
            },
        },
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

connection.onRenameRequest(async (params: LS.RenameParams, cancellationToken: LS.CancellationToken) => {
    const document: TextDocument | undefined = documents.get(params.textDocument.uri.toString());

    if (document === undefined) {
        return undefined;
    }

    const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "onRenameRequest");
    const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

    const result: PQP.Result<LS.TextEdit[] | undefined, PQP.CommonError.CommonError> = await analysis.getRenameEdits(
        params.position,
        params.newName,
        pqpCancellationToken,
    );

    if (PQP.ResultUtils.isOk(result)) {
        return result.value ? { changes: { [document.uri]: result.value } } : undefined;
    } else {
        ErrorUtils.handleError(connection, result.error, "onRenameRequest", traceManager);

        return undefined;
    }
});

connection.onRequest("powerquery/semanticTokens", async (params: SemanticTokenParams) => {
    const document: TextDocument | undefined = documents.get(params.textDocumentUri);

    if (document === undefined) {
        return [];
    }

    const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(undefined);
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "semanticTokens");
    const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

    const result: PQP.Result<PQLS.PartialSemanticToken[] | undefined, PQP.CommonError.CommonError> =
        await analysis.getPartialSemanticTokens(pqpCancellationToken);

    if (PQP.ResultUtils.isOk(result)) {
        return result.value ?? [];
    } else {
        ErrorUtils.handleError(connection, result.error, "semanticTokens", traceManager);

        return [];
    }
});

connection.onRequest(
    "powerquery/moduleLibraryUpdated",
    (params: ModuleLibraryUpdatedParams): LS.HandlerResult<void, unknown> => {
        try {
            ModuleLibraryUtils.onModuleAdded(params.workspaceUriPath, params.library);
            LibraryUtils.clearCache();
            connection.languages.diagnostics.refresh();
        } catch (error) {
            if (error instanceof Error) {
                return new LS.ResponseError(LS.ErrorCodes.InternalError, error.message, error);
            }

            return new LS.ResponseError(LS.ErrorCodes.InternalError, "An unknown error occurred.", error);
        }
    },
);

connection.onRequest(
    "powerquery/setLibrarySymbols",
    (params: SetLibrarySymbolsParams): LS.HandlerResult<void, unknown> => {
        try {
            // JSON-RPC doesn't support sending Maps, so we have to convert from tuple array.
            const symbolMaps: ReadonlyMap<string, LibraryJson | null> = new Map(params.librarySymbols);
            ExternalLibraryUtils.setRange(symbolMaps);
            LibraryUtils.clearCache();
            connection.languages.diagnostics.refresh();
        } catch (error) {
            if (error instanceof Error) {
                return new LS.ResponseError(LS.ErrorCodes.InternalError, error.message, error);
            }

            return new LS.ResponseError(LS.ErrorCodes.InternalError, "An unknown error occurred.", error);
        }
    },
);

connection.onSignatureHelp(
    async (
        params: LS.TextDocumentPositionParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.SignatureHelp> => {
        const emptySignatureHelp: LS.SignatureHelp = {
            signatures: [],
            activeParameter: undefined,
            activeSignature: 0,
        };

        const document: TextDocument | undefined = documents.get(params.textDocument.uri);

        if (document === undefined) {
            return emptySignatureHelp;
        }

        const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);

        const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
            params.textDocument.uri,
            "onSignatureHelp",
            params.position,
        );

        const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

        const result: PQP.Result<LS.SignatureHelp | undefined, PQP.CommonError.CommonError> =
            await analysis.getSignatureHelp(params.position, pqpCancellationToken);

        if (PQP.ResultUtils.isOk(result)) {
            return result.value ?? emptySignatureHelp;
        } else {
            ErrorUtils.handleError(connection, result.error, "onSignatureHelp", traceManager);

            return emptySignatureHelp;
        }
    },
);

connection.onDocumentFormatting(
    async (params: LS.DocumentFormattingParams, cancellationToken: LS.CancellationToken): Promise<LS.TextEdit[]> => {
        const document: TextDocument | undefined = documents.get(params.textDocument.uri);

        if (document === undefined) {
            return [];
        }

        const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
            params.textDocument.uri,
            "onDocumentFormatting",
            undefined,
        );

        const result: PQP.Result<LS.TextEdit[] | undefined, PQP.CommonError.CommonError> = await PQLS.tryFormat(
            document,
            {
                ...PQP.DefaultSettings,
                ...PQF.DefaultSettings,
                cancellationToken: SettingsUtils.createCancellationToken(cancellationToken),
                traceManager,
            },
        );

        if (PQP.ResultUtils.isOk(result)) {
            return result.value ?? [];
        } else {
            ErrorUtils.handleError(connection, result.error, "onDocumentFormatting", traceManager);

            return [];
        }
    },
);

connection.languages.diagnostics.on(
    // eslint-disable-next-line require-await
    async (params: LS.DocumentDiagnosticParams, cancellationToken: LS.CancellationToken) =>
        EventHandlerUtils.runSafeAsync(
            async () => {
                const document: TextDocument | undefined = documents.get(params.textDocument.uri);

                if (document === undefined) {
                    return {
                        kind: LS.DocumentDiagnosticReportKind.Full,
                        items: [],
                    };
                }

                const diagnostics: LS.Diagnostic[] = await getDocumentDiagnostics(document, cancellationToken);

                return {
                    kind: LS.DocumentDiagnosticReportKind.Full,
                    items: diagnostics,
                };
            },
            { kind: LS.DocumentDiagnosticReportKind.Full, items: [] },
            `Error while computing diagnostics for ${params.textDocument.uri}`,
            cancellationToken,
        ),
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function createAnalysis(document: TextDocument, traceManager: PQP.Trace.TraceManager): PQLS.Analysis {
    const localizedLibrary: PQLS.Library.ILibrary = SettingsUtils.getLibrary(document.uri);

    return PQLS.AnalysisUtils.analysis(document, SettingsUtils.createAnalysisSettings(localizedLibrary, traceManager));
}

async function documentSymbols(
    params: LS.DocumentSymbolParams,
    cancellationToken: LS.CancellationToken,
): Promise<LS.DocumentSymbol[] | undefined> {
    const document: TextDocument | undefined = documents.get(params.textDocument.uri);

    if (document === undefined) {
        return undefined;
    }

    const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);

    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
        params.textDocument.uri,
        "onDocumentSymbol",
    );

    const analysis: PQLS.Analysis = createAnalysis(document, traceManager);

    const triedParseState: PQP.Result<PQP.Parser.ParseState | undefined, PQP.CommonError.CommonError> =
        await analysis.getParseState();

    if (PQP.ResultUtils.isError(triedParseState)) {
        ErrorUtils.handleError(connection, triedParseState.error, "onDocumentSymbol", traceManager);

        return undefined;
    }

    if (triedParseState.value === undefined) {
        return undefined;
    }

    try {
        return PQLS.getDocumentSymbols(triedParseState.value.contextState.nodeIdMapCollection, pqpCancellationToken);
    } catch (error) {
        ErrorUtils.handleError(connection, error, "onDocumentSymbol", traceManager);

        return undefined;
    }
}

async function getDocumentDiagnostics(
    document: TextDocument,
    cancellationToken: LS.CancellationToken,
): Promise<LS.Diagnostic[]> {
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(
        document.uri,
        "getDocumentDiagnostics",
    );

    const localizedLibrary: PQLS.Library.ILibrary = SettingsUtils.getLibrary(document.uri);

    const analysisSettings: PQLS.AnalysisSettings = SettingsUtils.createAnalysisSettings(
        localizedLibrary,
        traceManager,
    );

    const validationSettings: PQLS.ValidationSettings = SettingsUtils.createValidationSettings(
        localizedLibrary,
        traceManager,
        SettingsUtils.createCancellationToken(cancellationToken),
    );

    const result: PQP.Result<PQLS.ValidateOk | undefined, PQP.CommonError.CommonError> = await PQLS.validate(
        document,
        analysisSettings,
        validationSettings,
    );

    if (PQP.ResultUtils.isOk(result) && result.value) {
        return result.value.diagnostics;
    } else {
        ErrorUtils.handleError(connection, result, "getDocumentDiagnostics", traceManager);

        return [];
    }
}
