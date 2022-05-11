// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import * as LS from "vscode-languageserver/node";
import * as path from "path";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { Position, TextDocument } from "vscode-languageserver-textdocument";

import { formatError } from "./errorUtils";
import { StandardLibraryUtils } from "./standardLibrary";

const LanguageId: string = "powerquery";

interface RenameIdentifierParams {
    readonly textDocumentUri: string;
    readonly position: Position;
    readonly newName: string;
}

interface ServerSettings {
    checkForDuplicateIdentifiers: boolean;
    checkInvokeExpressions: boolean;
    locale: string;
    isBenchmarksEnabled: boolean;
    isWorkspaceCacheAllowed: boolean;
}

const defaultServerSettings: ServerSettings = {
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: false,
    locale: PQP.DefaultLocale,
    isBenchmarksEnabled: false,
    isWorkspaceCacheAllowed: true,
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
        await connection.client.register(LS.DidChangeConfigurationNotification.type, undefined);
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

documents.onDidChangeContent(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // TODO: pass actual incremental changes into the workspace cache
    PQLS.documentClosed(event.document);

    try {
        return await validateDocument(event.document);
    } catch (error) {
        connection.console.error(`onCompletion error ${formatError(assertAsError(error))}`);

        return [];
    }
});

async function validateDocument(document: TextDocument): Promise<void> {
    const traceManager: PQP.Trace.TraceManager = createTraceManager(document.uri, "validateDocument");

    const result: PQLS.ValidationResult = await PQLS.validate(
        document,
        createValidationSettings(getLocalizedStandardLibrary(), traceManager),
    );

    connection.sendDiagnostics({
        uri: document.uri,
        version: document.version,
        diagnostics: result.diagnostics,
    });
}

connection.onDocumentFormatting(
    async (documentfomattingParams: LS.DocumentFormattingParams): Promise<LS.TextEdit[]> => {
        const maybeDocument: TextDocument | undefined = documents.get(documentfomattingParams.textDocument.uri);

        if (maybeDocument === undefined) {
            return [];
        }

        const document: TextDocument = maybeDocument;

        try {
            return await PQLS.tryFormat(document, documentfomattingParams.options, serverSettings.locale);
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

connection.onCompletion(
    async (
        textDocumentPosition: LS.TextDocumentPositionParams,
        _token: LS.CancellationToken,
    ): Promise<LS.CompletionItem[]> => {
        const document: TextDocument | undefined = documents.get(textDocumentPosition.textDocument.uri);

        if (document) {
            const traceManager: PQP.Trace.TraceManager = createTraceManager(
                textDocumentPosition.textDocument.uri,
                "onCompletion",
                textDocumentPosition.position,
            );

            const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position, traceManager);

            try {
                return await analysis.getAutocompleteItems();
            } catch (error) {
                connection.console.error(`onCompletion error ${formatError(assertAsError(error))}`);

                return [];
            }
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
            return await PQLS.getDocumentSymbols(document, PQP.DefaultSettings, serverSettings.isWorkspaceCacheAllowed);
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

        const traceManager: PQP.Trace.TraceManager = createTraceManager(
            textDocumentPosition.textDocument.uri,
            "onHover",
            textDocumentPosition.position,
        );

        const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position, traceManager);

        try {
            return await analysis.getHover();
        } catch (error) {
            connection.console.error(`onHover error ${formatError(assertAsError(error))}`);

            return emptyHover;
        }
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
            const traceManager: PQP.Trace.TraceManager = createTraceManager(
                textDocumentPosition.textDocument.uri,
                "onSignatureHelp",
                textDocumentPosition.position,
            );

            const analysis: PQLS.Analysis = createAnalysis(document, textDocumentPosition.position, traceManager);

            try {
                return await analysis.getSignatureHelp();
            } catch (error) {
                connection.console.error(`onSignatureHelp error ${formatError(assertAsError(error))}`);

                return emptySignatureHelp;
            }
        }

        return emptySignatureHelp;
    },
);

connection.onRequest("powerquery/renameIdentifier", async (params: RenameIdentifierParams) => {
    const document: TextDocument | undefined = documents.get(params.textDocumentUri);

    if (document) {
        try {
            const traceManager: PQP.Trace.TraceManager = createTraceManager(document.uri, "renameIdentifier");
            const analysis: PQLS.Analysis = createAnalysis(document, params.position, traceManager);

            return await analysis.getRenameEdits(params.newName);
        } catch (error) {
            connection.console.error(`on powerquery/renameIdentifier error ${formatError(assertAsError(error))}`);
        }
    }

    return [];
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function createAnalysis(
    document: TextDocument,
    position: PQLS.Position,
    traceManager: PQP.Trace.TraceManager,
): PQLS.Analysis {
    const localizedStandardLibrary: PQLS.Library.ILibrary = getLocalizedStandardLibrary();
    document.uri;

    return PQLS.AnalysisUtils.createAnalysis(
        document,
        createAnalysisSettings(localizedStandardLibrary, traceManager),
        position,
    );
}

function createAnalysisSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
): PQLS.AnalysisSettings {
    return {
        createInspectionSettingsFn: (): PQLS.InspectionSettings => createInspectionSettings(library, traceManager),
        library,
        isWorkspaceCacheAllowed: serverSettings.isWorkspaceCacheAllowed,
    };
}

function getLocalizedStandardLibrary(): PQLS.Library.ILibrary {
    return StandardLibraryUtils.getOrCreateStandardLibrary(serverSettings.locale);
}

function createInspectionSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
): PQLS.InspectionSettings {
    return PQLS.InspectionUtils.createInspectionSettings(
        {
            ...PQP.DefaultSettings,
            locale: serverSettings.locale,
            traceManager,
        },
        undefined,
        library.externalTypeResolver,
        serverSettings.isWorkspaceCacheAllowed,
    );
}

function createBenchmarkTraceManager(
    uri: string | undefined,
    sourceAction: string,
    position?: Position,
): PQP.Trace.BenchmarkTraceManager | undefined {
    if (!uri) {
        return undefined;
    }

    const source: string = path.basename(uri);

    if (position) {
        sourceAction += `L${position.line}C${position.character}`;
    }

    let benchmarkUri: string;

    // TODO: make this not O(n)
    for (let iteration: number = 0; iteration < 1000; iteration += 1) {
        benchmarkUri = path.join(path.dirname(uri), `${source}_${sourceAction}_${iteration}.log`);

        if (!fs.existsSync(benchmarkUri)) {
            const writeStream: fs.WriteStream = fs.createWriteStream(benchmarkUri, { flags: "w" });

            return new PQP.Trace.BenchmarkTraceManager((message: string) => writeStream.write(message));
        }
    }

    // TODO: handle fallback if all iterations are taken
    return undefined;
}

function createTraceManager(
    uri: string | undefined,
    sourceAction: string,
    position?: Position,
): PQP.Trace.TraceManager {
    return createBenchmarkTraceManager(uri, sourceAction, position) ?? new PQP.Trace.NoOpTraceManager();
}

function createValidationSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library, traceManager),
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
        isBenchmarksEnabled: config?.benchmark?.enable ?? false,
        isWorkspaceCacheAllowed: config?.diagnostics?.isWorkspaceCacheAllowed ?? true,
    };
}

function assertAsError<T>(value: T | Error): Error {
    if (value instanceof Error) {
        return value;
    }

    throw new Error(`received an error value that isn't an instanceof Error`);
}
