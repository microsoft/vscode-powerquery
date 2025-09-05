// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    CancellationToken,
    Connection,
    Diagnostic,
    Disposable,
    DocumentDiagnosticParams,
    DocumentDiagnosticReport,
    DocumentDiagnosticReportKind,
    TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as EventHandlerUtils from "./eventHandlerUtils";

export type Validator = (textDocument: TextDocument, cancellationToken?: CancellationToken) => Promise<Diagnostic[]>;

export type DiagnosticsSupport = {
    dispose(): void;
    requestRefresh(): void;
};

export function registerDiagnosticsPushSupport(
    documents: TextDocuments<TextDocument>,
    connection: Connection,
    runtime: EventHandlerUtils.RuntimeEnvironment,
    validate: Validator,
): DiagnosticsSupport {
    const pendingValidationRequests: { [uri: string]: Disposable } = {};
    const validationDelayMs: number = 500;
    const disposables: Disposable[] = [];

    // The content of a text document has changed. This event is emitted
    // when the text document first opened or when its content has changed.
    documents.onDidChangeContent(
        (change: { document: TextDocument }) => {
            triggerValidation(change.document);
        },
        undefined,
        disposables,
    );

    // a document has closed: clear all diagnostics
    documents.onDidClose(
        (event: { document: TextDocument }) => {
            cleanPendingValidation(event.document);
            void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
        },
        undefined,
        disposables,
    );

    function cleanPendingValidation(textDocument: TextDocument): void {
        const request: Disposable | undefined = pendingValidationRequests[textDocument.uri];

        if (request) {
            request.dispose();
            delete pendingValidationRequests[textDocument.uri];
        }
    }

    function triggerValidation(textDocument: TextDocument): void {
        cleanPendingValidation(textDocument);

        const request: Disposable = (pendingValidationRequests[textDocument.uri] = runtime.timer.setTimeout(
            async () => {
                if (request === pendingValidationRequests[textDocument.uri]) {
                    try {
                        const diagnostics: Diagnostic[] = await validate(textDocument);

                        if (request === pendingValidationRequests[textDocument.uri]) {
                            void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
                        }

                        delete pendingValidationRequests[textDocument.uri];
                    } catch (e: unknown) {
                        runtime.console.error(formatError(`Error while validating ${textDocument.uri}`, e));
                    }
                }
            },
            validationDelayMs,
        ));
    }

    return {
        requestRefresh: (): void => {
            documents.all().forEach(triggerValidation);
        },
        dispose: (): void => {
            disposables.forEach((d: Disposable) => d.dispose());
            disposables.length = 0;
            const keys: string[] = Object.keys(pendingValidationRequests);

            for (const key of keys) {
                pendingValidationRequests[key].dispose();
                delete pendingValidationRequests[key];
            }
        },
    };
}

export function registerDiagnosticsPullSupport(
    documents: TextDocuments<TextDocument>,
    connection: Connection,
    runtime: EventHandlerUtils.RuntimeEnvironment,
    validate: Validator,
): DiagnosticsSupport {
    function newDocumentDiagnosticReport(diagnostics: Diagnostic[]): DocumentDiagnosticReport {
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: diagnostics,
        };
    }

    const registration: Disposable = connection.languages.diagnostics.on(
        (params: DocumentDiagnosticParams, token: CancellationToken) =>
            EventHandlerUtils.runSafeAsync(
                runtime,
                async () => {
                    const document: TextDocument | undefined = documents.get(params.textDocument.uri);

                    if (document) {
                        return newDocumentDiagnosticReport(await validate(document, token));
                    }

                    return newDocumentDiagnosticReport([]);
                },
                newDocumentDiagnosticReport([]),
                `Error while computing diagnostics for ${params.textDocument.uri}`,
                token,
            ),
    );

    function requestRefresh(): void {
        connection.languages.diagnostics.refresh();
    }

    return {
        requestRefresh,
        dispose: (): void => {
            registration.dispose();
        },
    };
}

function formatError(message: string, err: unknown): string {
    if (err instanceof Error) {
        const error: Error = err as Error;

        return `${message}: ${error.message}\n${error.stack}`;
    } else if (typeof err === "string") {
        return `${message}: ${err}`;
    } else if (err && typeof err === "object" && "toString" in err) {
        return `${message}: ${err.toString()}`;
    }

    return message;
}
