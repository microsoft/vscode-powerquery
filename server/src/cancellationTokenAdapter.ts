// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQP from "@microsoft/powerquery-parser";

export class CancellationTokenAdapter implements PQP.ICancellationToken {
    constructor(
        protected readonly parserCancellationToken: PQP.ICancellationToken,
        protected readonly languageServerCancellationToken: LS.CancellationToken,
    ) {}

    public isCancelled(): boolean {
        return (
            this.parserCancellationToken.isCancelled() || this.languageServerCancellationToken.isCancellationRequested
        );
    }

    public throwIfCancelled(): void {
        if (this.isCancelled()) {
            this.parserCancellationToken.cancel();
        }
    }

    public cancel(): void {
        this.parserCancellationToken.cancel();
    }
}
