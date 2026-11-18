// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";

import { DiagnosticCancellationTracker } from "../diagnosticCancellationTracker";

class NoOpCancellationToken implements PQP.ICancellationToken {
    isCancelled: () => boolean = () => false;
    throwIfCancelled: () => void = () => {};
    cancel: () => void = () => {};
}

describe(`DiagnosticCancellationTracker`, () => {
    it(`does not remove a newer operation when an older operation finishes`, () => {
        const uri: string = "file:///example.pq";
        const olderToken: PQP.ICancellationToken = new NoOpCancellationToken();
        const newerToken: PQP.ICancellationToken = new NoOpCancellationToken();
        const tracker: DiagnosticCancellationTracker = new DiagnosticCancellationTracker();

        tracker.set(uri, olderToken);
        tracker.set(uri, newerToken);

        expect(tracker.delete(uri, olderToken)).to.equal(false);
        expect(tracker.get(uri)).to.equal(newerToken);
        expect(tracker.delete(uri, newerToken)).to.equal(true);
        expect(tracker.get(uri)).to.equal(undefined);
    });
});
