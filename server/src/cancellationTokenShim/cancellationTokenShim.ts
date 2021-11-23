// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as LS from "vscode-languageserver";

// A shim between languageserver's cancellation token and powerquery-parser's cancellation token.
export class CancellationTokenShim implements PQP.ICancellationToken {
    constructor(
        private readonly version: number,
        private readonly lsCancellationToken: LS.CancellationToken,
        private readonly getLatestVersionFn: () => number,
    ) {}

    public isCancelled(): boolean {
        return this.lsCancellationToken.isCancellationRequested || this.version < this.getLatestVersionFn();
    }

    public throwIfCancelled(): void {
        if (this.isCancelled()) {
            throw new PQP.CommonError.CancellationError(this);
        }
    }

    public cancel(): void {}
}
