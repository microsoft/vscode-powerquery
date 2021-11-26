// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export function formatError(error: Error): string {
    return JSON.stringify(errorMetadata(error), null, 4);
}

interface ErrorMetadata {
    readonly maybeChild: ErrorMetadata | undefined;
    readonly maybeTopOfStack: string | undefined;
    readonly message: any | undefined;
    readonly name: string;
}

function errorMetadata(error: Error): ErrorMetadata {
    let maybeChild: ErrorMetadata | undefined;

    if (
        error instanceof PQP.CommonError.CommonError ||
        error instanceof PQP.Lexer.LexError.LexError ||
        error instanceof PQP.Parser.ParseError.ParseError
    ) {
        maybeChild = errorMetadata(error.innerError);
    }

    return {
        maybeChild,
        maybeTopOfStack: error.stack?.split("\n")[0],
        message: error.message,
        name: error.name,
    };
}
