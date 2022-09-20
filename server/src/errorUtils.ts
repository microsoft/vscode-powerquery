// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQP from "@microsoft/powerquery-parser";

export interface FormatErrorMetadata {
    readonly maybeChild: FormatErrorMetadata | undefined;
    readonly maybeTopOfStack: string | undefined;
    readonly message: string | undefined;
    readonly name: string;
}

export function handleError(connection: LS.Connection, value: unknown, action: string): void {
    let userMessage: string;

    if (PQP.CommonError.isCommonError(value) && value.innerError instanceof PQP.CommonError.CancellationError) {
        return;
    } else if (value instanceof Error) {
        const error: Error = value;
        userMessage = error.message ?? `An unknown error occured during ${action}.`;
        connection.console.error(formatError(error));
    } else {
        connection.console.warn(`unknown error value: ${value}`);

        return;
    }

    connection.window.showErrorMessage(userMessage);
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
