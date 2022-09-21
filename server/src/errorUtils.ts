// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQP from "@microsoft/powerquery-parser";
import { Trace, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

export interface FormatErrorMetadata {
    readonly maybeChild: FormatErrorMetadata | undefined;
    readonly maybeTopOfStack: string | undefined;
    readonly message: string | undefined;
    readonly name: string;
}

export function handleError(
    connection: LS.Connection,
    value: unknown,
    action: string,
    traceManager: TraceManager,
): void {
    const trace: Trace = traceManager.entry("handleError", action, undefined);

    let vscodeEmitter: (message: string) => void;
    let vscodeMessage: string;

    if (PQP.CommonError.isCommonError(value) && value.innerError instanceof PQP.CommonError.CancellationError) {
        vscodeEmitter = connection.console.info;
        vscodeMessage = `CancellationError during ${action}.`;
    } else if (value instanceof Error) {
        const error: Error = value;
        const userMessage: string = error.message ?? `An unknown error occured during ${action}.`;

        vscodeEmitter = connection.console.error;
        vscodeMessage = formatError(error);

        connection.window.showErrorMessage(userMessage);
    } else {
        vscodeEmitter = connection.console.warn;
        vscodeMessage = `unknown error value '${value}' during ${action}.`;
    }

    vscodeEmitter(vscodeMessage);

    trace.exit({ vscodeMessage });
}

function formatError(error: Error): string {
    return JSON.stringify(formatErrorMetadata(error), null, 4);
}

function formatErrorMetadata(error: Error): FormatErrorMetadata {
    let maybeChild: FormatErrorMetadata | undefined;

    if (
        error instanceof PQP.CommonError.CommonError ||
        error instanceof PQP.Lexer.LexError.LexError ||
        error instanceof PQP.Parser.ParseError.ParseError
    ) {
        maybeChild = formatErrorMetadata(error.innerError);
    }

    const maybeSplitLines: ReadonlyArray<string> | undefined = error.stack?.split("\n");

    return {
        maybeChild,
        maybeTopOfStack: maybeSplitLines !== undefined ? maybeSplitLines.slice(0, 4).join("\n") : undefined,
        message: error.message,
        name: error.constructor.name,
    };
}
