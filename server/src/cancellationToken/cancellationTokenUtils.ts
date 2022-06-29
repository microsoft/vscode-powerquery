// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQP from "@microsoft/powerquery-parser";
import { CancellationTokenAdapter } from "./cancellationTokenAdapter";

export function create(cancellationToken: LS.CancellationToken, timeoutInMs: number): CancellationTokenAdapter {
    return new CancellationTokenAdapter(new PQP.TimedCancellationToken(timeoutInMs), cancellationToken);
}
