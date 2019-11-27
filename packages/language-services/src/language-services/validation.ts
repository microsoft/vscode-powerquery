// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { Diagnostic, DiagnosticSeverity, Position, TextDocument } from "vscode-languageserver-types";

import * as WorkspaceCache from "./workspaceCache";

export interface ValidationResult {
    readonly hasErrors: boolean;
    readonly diagnostics: Diagnostic[];
}

export function validate(document: TextDocument): ValidationResult {
    const triedLexParse: PQP.TriedLexParse = WorkspaceCache.getTriedLexAndParse(document);
    let diagnostics: Diagnostic[] = [];
    if (triedLexParse.kind !== PQP.ResultKind.Ok) {
        const lexAndParseErr: PQP.LexAndParseErr = triedLexParse.error;
        const innerError: PQP.LexError.TInnerLexError | PQP.ParseError.TInnerParseError = lexAndParseErr.innerError;
        if (PQP.ParseError.isTInnerParseError(innerError)) {
            const maybeDiagnostic: undefined | Diagnostic = maybeParseErrorToDiagnostic(innerError);
            if (maybeDiagnostic !== undefined) {
                diagnostics = [maybeDiagnostic];
            }
        } else if (PQP.LexError.isTInnerLexError(innerError)) {
            const maybeLexerErrorDiagnostics: undefined | Diagnostic[] = maybeLexErrorToDiagnostics(innerError);
            if (maybeLexerErrorDiagnostics !== undefined) {
                diagnostics = maybeLexerErrorDiagnostics;
            }
        }
    }
    return {
        hasErrors: diagnostics.length > 0,
        diagnostics,
    };
}

function maybeLexErrorToDiagnostics(error: PQP.LexError.TInnerLexError): undefined | Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    // TODO: handle other types of lexer errors
    if (error instanceof PQP.LexError.ErrorLineMapError) {
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PQP.LexError.TInnerLexError = errorLine.error.innerError;
            if ((innerError as any).graphemePosition) {
                const graphemePosition: PQP.StringUtils.GraphemePosition = (innerError as any).graphemePosition;
                const message: string = innerError.message;
                const position: Position = {
                    line: graphemePosition.lineNumber,
                    character: graphemePosition.lineCodeUnit,
                };
                // TODO: "lex" errors aren't that useful to display to end user. Should we make it more generic?
                diagnostics.push({
                    message: message,
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: position,
                        end: position,
                    },
                });
            }
        }
    }
    return diagnostics.length ? diagnostics : undefined;
}

function maybeParseErrorToDiagnostic(error: PQP.ParseError.TInnerParseError): undefined | Diagnostic {
    const message: string = error.message;
    let errorToken: PQP.Token;
    if (
        (error instanceof PQP.ParseError.ExpectedAnyTokenKindError ||
            error instanceof PQP.ParseError.ExpectedTokenKindError) &&
        error.maybeFoundToken !== undefined
    ) {
        errorToken = error.maybeFoundToken.token;
    } else if (error instanceof PQP.ParseError.InvalidPrimitiveTypeError) {
        errorToken = error.token;
    } else if (error instanceof PQP.ParseError.UnterminatedBracketError) {
        errorToken = error.openBracketToken;
    } else if (error instanceof PQP.ParseError.UnterminatedParenthesesError) {
        errorToken = error.openParenthesesToken;
    } else if (error instanceof PQP.ParseError.UnusedTokensRemainError) {
        errorToken = error.firstUnusedToken;
    } else {
        return undefined;
    }
    return {
        message: message,
        severity: DiagnosticSeverity.Error,
        range: {
            start: {
                line: errorToken.positionStart.lineNumber,
                character: errorToken.positionStart.lineCodeUnit,
            },
            end: {
                line: errorToken.positionEnd.lineNumber,
                character: errorToken.positionEnd.lineCodeUnit,
            },
        },
    };
}
