// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LexError, ParseError } from "@microsoft/powerquery-parser";

export type TFormatError = LexError.TLexError | ParseError.TParseError;

export function isTFormatError(x: any): x is TFormatError {
    return LexError.isTLexError(x) || ParseError.isTParseError(x);
}
