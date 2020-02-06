// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { DefaultTemplates, Result, ResultKind } from "@microsoft/powerquery-parser";
import { expect } from "chai";
import "mocha";
import { TFormatError } from "../../format/error";
import { format, FormatSettings } from "../../format/format";
import { IndentationLiteral, NewlineLiteral, SerializerOptions } from "../../format/serializer";

const DefaultSerializerOptions: SerializerOptions = {
    indentationLiteral: IndentationLiteral.SpaceX4,
    newlineLiteral: NewlineLiteral.Unix,
};

export function compare(expected: string, actual: string, options: SerializerOptions = DefaultSerializerOptions): void {
    expected = expected.trim();
    const actualLines: ReadonlyArray<string> = actual.split(options.newlineLiteral);
    const expectedLines: ReadonlyArray<string> = expected.split(options.newlineLiteral);

    const minLength: number = Math.min(actualLines.length, expectedLines.length);
    for (let lineNumber: number = 0; lineNumber < minLength; lineNumber += 1) {
        const actualLine: string = actualLines[lineNumber];
        const expectedLine: string = expectedLines[lineNumber];

        if (expectedLine !== actualLine) {
            const details: {} = {
                lineNumber,
                expectedLine,
                actualLine,
            };
            expect(actualLine).to.equal(expectedLine, JSON.stringify(details, undefined, 4));
        }
    }

    const edgeExpectedLine: string = expectedLines[minLength];
    const edgeActualLine: string = actualLines[minLength];
    expect(edgeActualLine).to.equal(edgeExpectedLine, `line:${minLength + 1}`);
}

// attempts to format text twice to ensure the formatter emits the same tokens.
export function runFormat(text: string, serializerOptions: SerializerOptions = DefaultSerializerOptions): string {
    text = text.trim();
    const firstFormatRequest: FormatSettings = createFormatSettings(text, serializerOptions);
    const firstFormatResult: Result<string, TFormatError> = format(firstFormatRequest);
    if (firstFormatResult.kind === ResultKind.Err) {
        throw firstFormatResult.error;
    }
    const firstOk: string = firstFormatResult.value;

    const secondFormatRequest: FormatSettings = createFormatSettings(firstOk, serializerOptions);
    const secondFormatResult: Result<string, TFormatError> = format(secondFormatRequest);
    if (secondFormatResult.kind === ResultKind.Err) {
        throw secondFormatResult.error;
    }
    const secondOk: string = secondFormatResult.value;

    compare(firstOk, secondOk);
    return firstOk;
}

function createFormatSettings(
    text: string,
    serializerOptions: SerializerOptions = DefaultSerializerOptions,
): FormatSettings {
    return {
        localizationTemplates: DefaultTemplates,
        text,
        options: serializerOptions,
    };
}
