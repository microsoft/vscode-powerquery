// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as vscode from "vscode";

import { LibraryJson, PowerQueryApi } from "./vscode-powerquery.api";

// Minimal implementation to faciliate unit testing
export type MinimalPowerQueryLanguageServiceClient = Pick<LC.LanguageClient, "sendRequest" | "isRunning">;

// We might need to rename/refactor this in the future if the exported API has functions unrelated to symbols.
export class LibrarySymbolClient implements PowerQueryApi {
    constructor(private lsClient: MinimalPowerQueryLanguageServiceClient) {}

    // TODO: Deprecate
    public onModuleLibraryUpdated(workspaceUriPath: string, library: LibraryJson): void {
        if (this.lsClient?.isRunning()) {
            void this.lsClient.sendRequest("powerquery/moduleLibraryUpdated", {
                workspaceUriPath,
                library,
            });
        }
    }

    public async setLibrarySymbols(
        librarySymbols: [string, LibraryJson | null][],
        token?: vscode.CancellationToken,
    ): Promise<void> {
        if (this.lsClient?.isRunning()) {
            await this.lsClient.sendRequest(
                "powerquery/setLibrarySymbols",
                {
                    librarySymbols,
                },
                token,
            );
        }
    }
}
