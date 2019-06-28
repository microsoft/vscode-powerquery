// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LexerError, ParserError } from "@microsoft/powerquery-parser";

export type TFormatError = LexerError.TLexerError | ParserError.TParserError;

export function isTFormatError(x: any): x is TFormatError {
    return LexerError.isTLexerError(x) || ParserError.isTParserError(x);
}
