// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LexError, IParserState, ParseError } from "@microsoft/powerquery-parser";

export type TFormatError<S = IParserState> = LexError.TLexError | ParseError.TParseError<S>;

export function isTFormatError<S = IParserState>(x: any): x is TFormatError<S> {
    return LexError.isTLexError(x) || ParseError.isTParseError(x);
}
