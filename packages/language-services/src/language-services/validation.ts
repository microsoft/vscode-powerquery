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
    const triedLexAndParse: PQP.TriedLexAndParse = WorkspaceCache.getTriedLexAndParse(document);
    let diagnostics: Diagnostic[] = [];
    if (triedLexAndParse.kind !== PQP.ResultKind.Ok) {
        const lexAndParseErr: PQP.LexAndParseErr = triedLexAndParse.error;
        const innerError: PQP.LexerError.TInnerLexerError | PQP.ParserError.TInnerParserError =
            lexAndParseErr.innerError;
        if (PQP.ParserError.isTInnerParserError(innerError)) {
            const maybeDiagnostic: undefined | Diagnostic = maybeParserErrorToDiagnostic(innerError);
            if (maybeDiagnostic !== undefined) {
                diagnostics = [maybeDiagnostic];
            }
        } else if (PQP.LexerError.isTInnerLexerError(innerError)) {
            const maybeLexerErrorDiagnostics: undefined | Diagnostic[] = maybeLexerErrorToDiagnostics(innerError);
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

function maybeLexerErrorToDiagnostics(error: PQP.LexerError.TInnerLexerError): undefined | Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    // TODO: handle other types of lexer errors
    if (error instanceof PQP.LexerError.ErrorLineMapError) {
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PQP.LexerError.TInnerLexerError = errorLine.error.innerError;
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

function maybeParserErrorToDiagnostic(error: PQP.ParserError.TInnerParserError): undefined | Diagnostic {
    const message: string = error.message;
    let errorToken: PQP.Token;
    if (
        (error instanceof PQP.ParserError.ExpectedAnyTokenKindError ||
            error instanceof PQP.ParserError.ExpectedTokenKindError) &&
        error.maybeFoundToken !== undefined
    ) {
        errorToken = error.maybeFoundToken.token;
    } else if (error instanceof PQP.ParserError.InvalidPrimitiveTypeError) {
        errorToken = error.token;
    } else if (error instanceof PQP.ParserError.UnterminatedBracketError) {
        errorToken = error.openBracketToken;
    } else if (error instanceof PQP.ParserError.UnterminatedParenthesesError) {
        errorToken = error.openParenthesesToken;
    } else if (error instanceof PQP.ParserError.UnusedTokensRemainError) {
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
