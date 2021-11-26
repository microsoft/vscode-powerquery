// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import { formatError } from "../errorUtils";

describe(`errorUtils`, () => {
    describe(`formatError`, () => {
        it(`unknown error`, () => {
            const actual: string = formatError(new Error("foobar"));
            const expected: string = "";
            expect(expected).to.equal(actual);
        });
    });
});
