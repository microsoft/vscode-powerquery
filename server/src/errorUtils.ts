// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export function formatError(error: Error): string {
    return JSON.stringify(formatErrorMetadata(error), null, 4);
}

export interface FormatErrorMetadata {
    readonly maybeChild: FormatErrorMetadata | undefined;
    readonly maybeTopOfStack: string | undefined;
    readonly message: string | undefined;
    readonly name: string;
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
