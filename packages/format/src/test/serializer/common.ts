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

// attempts to format the document, then takes the result and formats the result
// to ensure I don't emit any new tokens.
export function runFormat(document: string, serializerOptions = DefaultSerializerOptions): string {
    document = document.trim();
    const firstFormatRequest = createFormatRequest(document, serializerOptions);
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

function createFormatRequest(document: string, serializerOptions = DefaultSerializerOptions): FormatRequest {
    return {
        document,
        options: serializerOptions,
    }
}
