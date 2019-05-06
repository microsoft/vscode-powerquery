import { LexerError, ParserError } from "powerquery-parser";

export namespace FormatError {
    export type TFormatError = (
        | LexerError.TLexerError
        | ParserError.TParserError
    )

    export function isTFormatError(x: any): x is TFormatError {
        return (
            LexerError.isTLexerError(x)
            || ParserError.isTParserError(x)
        );
    }
}