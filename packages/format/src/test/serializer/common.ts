import { expect } from "chai";
import "mocha";
import { format, FormatRequest } from "../../format/format";
import { IndentationLiteral, NewlineLiteral, SerializerOptions } from "../../format/serializer";
import { ResultKind } from "@microsoft/powerquery-parser";

const DefaultSerializerOptions: SerializerOptions = {
    indentationLiteral: IndentationLiteral.SpaceX4,
    newlineLiteral: NewlineLiteral.Unix,
};

export function compare(expected: string, actual: string, options = DefaultSerializerOptions) {
    expected = expected.trim();
    const actualLines = actual.split(options.newlineLiteral);
    const expectedLines = expected.split(options.newlineLiteral);

    const minLength = Math.min(actualLines.length, expectedLines.length);
    for (let index = 0; index < minLength; index++) {
        const actualLine = actualLines[index];
        const expectedLine = expectedLines[index];

        if (expectedLine !== actualLine) {
            const errorMessage = `\nexpected:\n${expected}\n\nactual:\n${actual}`;
            expect(actualLine).to.equal(expectedLine, errorMessage);
        }
    }

    const edgeExpectedLine = expectedLines[minLength];
    const edgeActualLine = actualLines[minLength];
    expect(edgeActualLine).to.equal(edgeExpectedLine, `line:${minLength + 1}`);
}

// attempts to format text twice to ensure the formatter emits the same tokens.
export function runFormat(text: string, serializerOptions = DefaultSerializerOptions): string {
    text = text.trim();
    const firstFormatRequest = createFormatRequest(text, serializerOptions);
    const firstFormatResult = format(firstFormatRequest);
    if (firstFormatResult.kind === ResultKind.Err) {
        throw firstFormatResult.error;
    }
    const firstOk = firstFormatResult.value;

    const secondFormatRequest = createFormatRequest(firstOk, serializerOptions);
    const secondFormatResult = format(secondFormatRequest);
    if (secondFormatResult.kind === ResultKind.Err) {
        throw secondFormatResult.error;
    }
    const secondOk = secondFormatResult.value;

    compare(firstOk, secondOk);
    return firstOk;
}

function createFormatRequest(text: string, serializerOptions = DefaultSerializerOptions): FormatRequest {
    return {
        text,
        options: serializerOptions,
    }
}
