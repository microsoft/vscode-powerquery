// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { expect } from "chai";
import { formatError, FormatErrorMetadata } from "../errorUtils";

type AbridgedFormatErrorMetadata = Pick<FormatErrorMetadata, "message" | "name"> & {
    readonly maybeChild: AbridgedFormatErrorMetadata | undefined;
};

function abridgedFormattedError(text: string): AbridgedFormatErrorMetadata {
    const metadata: FormatErrorMetadata = JSON.parse(text);
    return stripMaybeTopOfStack(metadata);
}

function stripMaybeTopOfStack(obj: FormatErrorMetadata): AbridgedFormatErrorMetadata {
    return {
        maybeChild: obj.maybeChild ? stripMaybeTopOfStack(obj.maybeChild) : undefined,
        message: obj.message,
        name: obj.name,
    };
}

describe(`errorUtils`, () => {
    describe(`formatError`, () => {
        it(`unknown error`, () => {
            const actual: AbridgedFormatErrorMetadata = abridgedFormattedError(formatError(new Error("foobar")));
            const expected: AbridgedFormatErrorMetadata = {
                maybeChild: undefined,
                message: "foobar",
                name: Error.name,
            };
            expect(actual).to.deep.equal(expected);
        });

        it(`InvariantError`, () => {
            const actual: AbridgedFormatErrorMetadata = abridgedFormattedError(
                formatError(new PQP.CommonError.CommonError(new PQP.CommonError.InvariantError("1 <> 2"))),
            );
            const expected: AbridgedFormatErrorMetadata = {
                maybeChild: {
                    maybeChild: undefined,
                    message: "InvariantError: 1 <> 2",
                    name: PQP.CommonError.InvariantError.name,
                },
                message: "InvariantError: 1 <> 2",
                name: PQP.CommonError.CommonError.name,
            };
            expect(actual).to.deep.equal(expected);
        });
    });
});
