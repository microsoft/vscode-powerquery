// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import * as LS from "vscode-languageserver/node";
import * as path from "path";
import * as PQF from "@microsoft/powerquery-formatter";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { Position, TextDocument } from "vscode-languageserver-textdocument";

import { formatError } from "./errorUtils";
import { LibraryUtils } from "./library";

const LanguageId: string = "powerquery";

interface RenameIdentifierParams {
    readonly textDocumentUri: string;
    readonly position: LS.Position;
    readonly newName: string;
}

interface ServerSettings {
    checkForDuplicateIdentifiers: boolean;
    checkInvokeExpressions: boolean;
    experimental: boolean;
    isBenchmarksEnabled: boolean;
    isWorkspaceCacheAllowed: boolean;
    locale: string;
    mode: "Power Query" | "SDK";
    typeStrategy: PQLS.TypeStrategy;
}

const defaultServerSettings: ServerSettings = {
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: false,
    experimental: false,
    isBenchmarksEnabled: false,
    isWorkspaceCacheAllowed: true,
    locale: PQP.DefaultLocale,
    mode: "Power Query",
    typeStrategy: PQLS.TypeStrategy.Primitive,
};

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);
const documents: LS.TextDocuments<TextDocument> = new LS.TextDocuments(TextDocument);
const NoOpTraceManager: PQP.Trace.NoOpTraceManager = new PQP.Trace.NoOpTraceManager();

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

documents.onDidClose(async (event: LS.TextDocumentChangeEvent<TextDocument>) => {
    // Clear any errors associated with this file
    await connection.sendDiagnostics({
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
        createValidationSettings(getLocalizedLibrary(), traceManager),
    );

    await connection.sendDiagnostics({
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: any = await connection.workspace.getConfiguration({ section: "powerquery" });
        const experimental: boolean = config?.general?.experimental;

        try {
            return await PQLS.tryFormat(
                document,
                {
                    ...PQP.DefaultSettings,
                    indentationLiteral: PQF.IndentationLiteral.SpaceX4,
                    newlineLiteral: PQF.NewlineLiteral.Windows,
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
            activeParameter: undefined,
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
    const localizedLibrary: PQLS.Library.ILibrary = getLocalizedLibrary();
    document.uri;

    return PQLS.AnalysisUtils.createAnalysis(
        document,
        createAnalysisSettings(localizedLibrary, traceManager),
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
        traceManager,
        maybeInitialCorrelationId: undefined,
    };
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
        {
            library,
            isWorkspaceCacheAllowed: serverSettings.isWorkspaceCacheAllowed,
            typeStrategy: serverSettings.typeStrategy,
        },
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

    let source: string = path.parse(uri).name;

    // If untitled document
    if (uri.startsWith("untitled:")) {
        source = source.slice("untitled:".length);
    }
    // Else expect it to be a file
    else {
        source = path.parse(uri).name;
    }

    if (!source) {
        return undefined;
    }

    if (position) {
        sourceAction += `L${position.line}C${position.character}`;
    }

    const logDirectory: string = path.join(process.cwd(), "vscode-powerquery-logs");

    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    let benchmarkUri: string;

    // TODO: make this not O(n)
    for (let iteration: number = 0; iteration < 1000; iteration += 1) {
        benchmarkUri = path.join(logDirectory, `${source}_${sourceAction}_${iteration}.log`);

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
    if (serverSettings.isBenchmarksEnabled) {
        return createBenchmarkTraceManager(uri, sourceAction, position) ?? NoOpTraceManager;
    } else {
        return NoOpTraceManager;
    }
}

function createValidationSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library, traceManager),
        LanguageId,
        {
            checkForDuplicateIdentifiers: serverSettings.checkForDuplicateIdentifiers,
            checkInvokeExpressions: serverSettings.checkInvokeExpressions,
        },
    );
}

async function fetchConfigurationSettings(): Promise<ServerSettings> {
    if (!hasConfigurationCapability) {
        return defaultServerSettings;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = await connection.workspace.getConfiguration({ section: "powerquery" });
    const maybeTypeStrategy: PQLS.TypeStrategy | undefined = config?.diagnostics?.typeStrategy;
    const experimental: boolean = config?.general?.experimental;

    return {
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: false,
        experimental,
        isBenchmarksEnabled: config?.benchmark?.enable ?? false,
        isWorkspaceCacheAllowed: config?.diagnostics?.isWorkspaceCacheAllowed ?? true,
        locale: config?.general?.locale ?? PQP.DefaultLocale,
        mode: deriveMode(config?.general?.mode),
        typeStrategy: maybeTypeStrategy ? deriveTypeStrategy(maybeTypeStrategy) : PQLS.TypeStrategy.Primitive,
    };
}

function getLocalizedLibrary(): PQLS.Library.ILibrary {
    switch (serverSettings.mode) {
        case "SDK":
            return LibraryUtils.getOrCreateSdkLibrary(serverSettings.locale);

        case "Power Query":
            return LibraryUtils.getOrCreateStandardLibrary(serverSettings.locale);

        default:
            throw PQP.Assert.isNever(serverSettings.mode);
    }
}

function deriveMode(value: string | undefined): "Power Query" | "SDK" {
    switch (value) {
        case "SDK":
            return "SDK";

        default:
            return "Power Query";
    }
}

function deriveTypeStrategy(value: string): PQLS.TypeStrategy {
    switch (value) {
        case PQLS.TypeStrategy.Extended:
        case PQLS.TypeStrategy.Primitive:
            return value;

        default:
            throw new PQP.CommonError.InvariantError(`could not derive typeStrategy`);
    }
}

function assertAsError<T>(value: T | Error): Error {
    if (value instanceof Error) {
        return value;
    }

    throw new Error(`received an error value that isn't an instanceof Error`);
}
