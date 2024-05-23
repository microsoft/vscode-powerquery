// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQP from "@microsoft/powerquery-parser";
import { CancellationTokenAdapter } from "./cancellationTokenAdapter";

export function createAdapterOrTimedCancellation(
    cancellationToken: LS.CancellationToken | undefined,
    timeoutInMs: number,
): PQP.ICancellationToken {
    return cancellationToken ? createAdapter(cancellationToken, timeoutInMs) : createTimedCancellation(timeoutInMs);
}

function createAdapter(cancellationToken: LS.CancellationToken, timeoutInMs: number): CancellationTokenAdapter {
    return new CancellationTokenAdapter(createTimedCancellation(timeoutInMs), cancellationToken);
}

function createTimedCancellation(timeoutInMs: number): PQP.TimedCancellationToken {
    return new PQP.TimedCancellationToken(timeoutInMs);
}
