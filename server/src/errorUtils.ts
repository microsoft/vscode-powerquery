// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQP from "@microsoft/powerquery-parser";
import { Trace, TraceManager } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";

export interface FormatErrorMetadata {
    readonly child: FormatErrorMetadata | undefined;
    readonly topOfStack: string | undefined;
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
    let vscodeMessage: string;

    if (PQP.CommonError.isCommonError(value) && value.innerError instanceof PQP.CommonError.CancellationError) {
        vscodeMessage = `CancellationError during ${action}.`;
        connection.console.info(vscodeMessage);
    } else if (value instanceof Error) {
        const error: Error = value;
        const userMessage: string = error.message ?? `An unknown error occured during ${action}.`;
        connection.window.showErrorMessage(userMessage);

        vscodeMessage = formatError(error);
        connection.console.error(vscodeMessage);
    } else {
        vscodeMessage = `unknown error value '${value}' during ${action}.`;
        connection.console.warn(vscodeMessage);
    }

    trace.exit({ vscodeMessage });
}

export function formatError(error: Error): string {
    return JSON.stringify(formatErrorMetadata(error), null, 4);
}

function formatErrorMetadata(error: Error): FormatErrorMetadata {
    let child: FormatErrorMetadata | undefined;

    if (
        error instanceof PQP.CommonError.CommonError ||
        error instanceof PQP.Lexer.LexError.LexError ||
        error instanceof PQP.Parser.ParseError.ParseError
    ) {
        child = formatErrorMetadata(error.innerError);
    }

    const splitLines: ReadonlyArray<string> | undefined = error.stack?.split("\n");

    return {
        child,
        topOfStack: splitLines?.slice(0, 4).join("\n"),
        message: error.message,
        name: error.constructor.name,
    };
}
