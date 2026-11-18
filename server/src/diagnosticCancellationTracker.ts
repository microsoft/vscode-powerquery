// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

export class DiagnosticCancellationTracker {
    private readonly activeOperations: Map<string, PQP.ICancellationToken> = new Map();

    public get(uri: string): PQP.ICancellationToken | undefined {
        return this.activeOperations.get(uri);
    }

    public set(uri: string, cancellationToken: PQP.ICancellationToken): void {
        this.activeOperations.set(uri, cancellationToken);
    }

    public delete(uri: string, cancellationToken: PQP.ICancellationToken): boolean {
        if (this.activeOperations.get(uri) !== cancellationToken) {
            return false;
        }

        return this.activeOperations.delete(uri);
    }
}
