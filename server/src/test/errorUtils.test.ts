// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { formatError, FormatErrorMetadata } from "../errorUtils";

type AbridgedFormatErrorMetadata = Pick<FormatErrorMetadata, "message" | "name"> & {
    readonly child: AbridgedFormatErrorMetadata | undefined;
};

function abridgedFormattedError(text: string): AbridgedFormatErrorMetadata {
    const metadata: FormatErrorMetadata = JSON.parse(text);

    return stripTopOfStack(metadata);
}

function stripTopOfStack(obj: FormatErrorMetadata): AbridgedFormatErrorMetadata {
    return {
        child: obj.child ? stripTopOfStack(obj.child) : undefined,
        message: obj.message,
        name: obj.name,
    };
}

describe(`errorUtils`, () => {
    describe(`formatError`, () => {
        it(`unknown error`, () => {
            const actual: AbridgedFormatErrorMetadata = abridgedFormattedError(formatError(new Error("foobar")));

            const expected: AbridgedFormatErrorMetadata = {
                child: undefined,
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
                child: {
                    child: undefined,
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
