// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQF from "@microsoft/powerquery-formatter";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { DefinitionParams, RenameParams } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as ErrorUtils from "./errorUtils";
import * as FuncUtils from "./funcUtils";
import * as TraceManagerUtils from "./traceManagerUtils";
import { getLocalizedModuleLibraryFromTextDocument } from "./settings.ts/settingsUtils";
import { ModuleLibraries } from "./library";
import { SettingsUtils } from "./settings.ts";

interface SemanticTokenParams {
    readonly textDocumentUri: string;
    readonly cancellationToken: LS.CancellationToken;
}

interface ModuleLibraryUpdatedParams {
    readonly workspaceUriPath: string;
    readonly library: ReadonlyArray<PQLS.LibrarySymbol.LibrarySymbol>;
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);
const moduleLibraries: ModuleLibraries = new ModuleLibraries();

const debouncedValidateDocument: (this: unknown, textDocument: PQLS.TextDocument) => Promise<void> =
    FuncUtils.partitionFn(
        () => FuncUtils.debounce(validateDocument, 250),
        (textDocument: TextDocument) => `validateDocument:${textDocument.uri.toString()}`,
    );

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
        ErrorUtils.handleError(connection, result.error, "onComplection", traceManager);

        return [];
    }
});

connection.onDidChangeConfiguration(async () => {
    await SettingsUtils.initializeServerSettings(connection);
    documents.all().forEach(debouncedValidateDocument);
});

documents.onDidChangeContent(
    async (event: LS.TextDocumentChangeEvent<TextDocument>) => await debouncedValidateDocument(event.document),
);

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
            ErrorUtils.handleError(connection, result.error, "onHover", traceManager);

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

    documents.all().forEach(debouncedValidateDocument);
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

connection.onRequest("powerquery/moduleLibraryUpdated", (params: ModuleLibraryUpdatedParams): void => {
    const allTextDocuments: TextDocument[] = moduleLibraries.addOneModuleLibrary(
        params.workspaceUriPath,
        params.library,
    );

    // need to validate those currently opened documents
    void Promise.all(allTextDocuments.map(debouncedValidateDocument));
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

// The onChange event doesn't include a cancellation token, so we have to manage them ourselves,
// done by keeping a Map<uri, existing cancellation token for uri>.
// Whenever a new validation attempt begins we check if an existing token for the uri exists and cancels it.
// Then we store ValidationSettings.cancellationToken for the uri if one exists.
const onValidateCancellationTokens: Map<string, PQP.ICancellationToken> = new Map();

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

async function validateDocument(document: TextDocument): Promise<void> {
    const traceManager: PQP.Trace.TraceManager = TraceManagerUtils.createTraceManager(document.uri, "validateDocument");

    const localizedLibrary: PQLS.Library.ILibrary = getLocalizedModuleLibraryFromTextDocument(
        moduleLibraries,
        document,
        true,
    );

    const analysisSettings: PQLS.AnalysisSettings = SettingsUtils.createAnalysisSettings(
        localizedLibrary,
        traceManager,
    );

    const validationSettings: PQLS.ValidationSettings = SettingsUtils.createValidationSettings(
        localizedLibrary,
        traceManager,
    );

    const uri: string = document.uri.toString();
    const existingCancellationToken: PQP.ICancellationToken | undefined = onValidateCancellationTokens.get(uri);

    if (existingCancellationToken !== undefined) {
        existingCancellationToken.cancel("A new validateDocument call was made.");
        onValidateCancellationTokens.delete(uri);
    }

    const newCancellationToken: PQP.ICancellationToken | undefined = validationSettings.cancellationToken;

    if (newCancellationToken !== undefined) {
        onValidateCancellationTokens.set(uri, newCancellationToken);
    }

    const result: PQP.Result<PQLS.ValidateOk | undefined, PQP.CommonError.CommonError> = await PQLS.validate(
        document,
        analysisSettings,
        validationSettings,
    );

    if (PQP.ResultUtils.isOk(result) && result.value) {
        await connection.sendDiagnostics({
            uri: document.uri,
            version: document.version,
            diagnostics: result.value.diagnostics,
        });
    } else {
        ErrorUtils.handleError(connection, result, "validateDocument", traceManager);
    }
}
