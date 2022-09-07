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
            ErrorUtils.handleError(connection, result.error, "onComplection");

            return [];
        }
    },
);

connection.onDefinition(async (params: DefinitionParams, cancellationToken: LS.CancellationToken) => {
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
        ErrorUtils.handleError(connection, result.error, "onComplection");

        return [];
    }
});

connection.onDidChangeConfiguration(async () => {
    await SettingsUtils.initializeServerSettings(connection);
    documents.all().forEach(validateDocument);
});

documents.onDidChangeContent(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
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
});

connection.onDocumentSymbol(
    async (
        params: LS.DocumentSymbolParams,
        cancellationToken: LS.CancellationToken,
    ): Promise<LS.DocumentSymbol[] | undefined> => {
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
        const parseState: PQP.Parser.ParseState | undefined = await analysis.getParseState();

        if (parseState === undefined) {
            return undefined;
        }

        try {
            return PQLS.getDocumentSymbols(parseState.contextState.nodeIdMapCollection, pqpCancellationToken);
        } catch (error) {
            ErrorUtils.handleError(connection, error, "onDocumentSymbol");

            return undefined;
        }
    },
);

connection.onHover(
    async (params: LS.TextDocumentPositionParams, cancellationToken: LS.CancellationToken): Promise<LS.Hover> => {
        const emptyHover: LS.Hover = {
            range: undefined,
            contents: [],
        };

        const document: TextDocument | undefined = documents.get(params.textDocument.uri);

        if (document === undefined) {
            return emptyHover;
        }

        const pqpCancellationToken: PQP.ICancellationToken = SettingsUtils.createCancellationToken(cancellationToken);

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
            ErrorUtils.handleError(connection, result.error, "onHover");

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
        ErrorUtils.handleError(connection, result.error, "onRenameRequest");

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

    try {
        return await analysis.getPartialSemanticTokens(pqpCancellationToken);
    } catch (error) {
        ErrorUtils.handleError(connection, error, "semanticTokens");

        return [];
    }
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
            ErrorUtils.handleError(connection, result.error, "onRenameRequest");

            return emptySignatureHelp;
        }
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
            return await PQLS.tryFormat(document, {
                ...PQP.DefaultSettings,
                indentationLiteral: PQF.IndentationLiteral.SpaceX4,
                newlineLiteral: PQF.NewlineLiteral.Windows,
                cancellationToken: SettingsUtils.createCancellationToken(cancellationToken),
                maxWidth: experimental ? 120 : undefined,
            });
        } catch (error) {
            ErrorUtils.handleError(connection, error, "onDocumentFormatting");

            return [];
        }
    },
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function createAnalysis(document: TextDocument, traceManager: PQP.Trace.TraceManager): PQLS.Analysis {
    const localizedLibrary: PQLS.Library.ILibrary = getLocalizedModuleLibraryFromTextDocument(
        moduleLibraries,
        document,
    );

    return PQLS.AnalysisUtils.createAnalysis(
        document,
        SettingsUtils.createAnalysisSettings(localizedLibrary, traceManager),
    );
}

async function validateDocument(document: TextDocument): Promise<void> {
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "validateDocument");

    const localizedLibrary: PQLS.Library.ILibrary = getLocalizedModuleLibraryFromTextDocument(
        moduleLibraries,
        document,
        true,
    );

    let result: PQLS.ValidationResult;

    try {
        result = await PQLS.validate(
            document,
            SettingsUtils.createAnalysisSettings(localizedLibrary, traceManager),
            SettingsUtils.createValidationSettings(localizedLibrary, traceManager),
        );
    } catch (error) {
        ErrorUtils.handleError(connection, error, "validateDocument");

        return;
    }

    await connection.sendDiagnostics({
        uri: document.uri,
        version: document.version,
        diagnostics: result.diagnostics,
    });
}
