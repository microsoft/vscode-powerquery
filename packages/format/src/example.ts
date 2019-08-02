// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* tslint:disable:no-console */
import { Result, ResultKind } from "@microsoft/powerquery-parser";
import { format, FormatRequest, IndentationLiteral, NewlineLiteral } from "./format";
import { TFormatError } from "./format/error";

// const text: string = `a = true and b = true and c = true`;
const text: string = `1 < 2 and 3 > 4 and 5 <> 6 + 7 + 8 * 9`;
const request: FormatRequest = {
    text,
    options: {
        indentationLiteral: IndentationLiteral.SpaceX4,
        newlineLiteral: NewlineLiteral.Unix,
    },
};

const formatResult: Result<string, TFormatError> = format(request);
if (formatResult.kind === ResultKind.Ok) {
    console.log(formatResult.value);
} else {
    console.log(JSON.stringify(formatResult.error, undefined, 4));
}
