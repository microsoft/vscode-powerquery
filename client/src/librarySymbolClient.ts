// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as vscode from "vscode";

import { LibraryJson, PowerQueryApi } from "./powerQueryApi";

// Minimal implementation to faciliate unit testing
export type MinimalPowerQueryLanguageServiceClient = Pick<
    LC.BaseLanguageClient,
    "sendRequest" | "isRunning" | "info" | "error"
>;

// We might need to rename/refactor this in the future if the exported API has functions unrelated to symbols.
export class LibrarySymbolClient implements PowerQueryApi {
    constructor(private lsClient: MinimalPowerQueryLanguageServiceClient) {}

    public onModuleLibraryUpdated(workspaceUriPath: string, library: LibraryJson): void {
        if (this.lsClient.isRunning()) {
            this.lsClient.info("Calling powerquery/moduleLibraryUpdated");

            void this.lsClient.sendRequest("powerquery/moduleLibraryUpdated", {
                workspaceUriPath,
                library,
            });
        } else {
            this.lsClient.error("Received moduleLibraryUpdated call but client is not running.", undefined, false);
        }
    }

    public async addLibrarySymbols(
        librarySymbols: ReadonlyMap<string, LibraryJson | null>,
        token?: vscode.CancellationToken,
    ): Promise<void> {
        if (this.lsClient.isRunning()) {
            // The JSON-RPC libraries don't support sending maps, so we convert it to a tuple array.
            const librarySymbolsTuples: ReadonlyArray<[string, LibraryJson | null]> = Array.from(
                librarySymbols.entries(),
            );

            await this.lsClient.sendRequest(
                "powerquery/addLibrarySymbols",
                {
                    librarySymbols: librarySymbolsTuples,
                },
                token,
            );
        } else {
            this.lsClient.error("Received addLibrarySymbols call but client is not running.", undefined, false);
        }
    }

    public async removeLibrarySymbols(
        librariesToRemove: ReadonlyArray<string>,
        token?: vscode.CancellationToken,
    ): Promise<void> {
        if (this.lsClient.isRunning()) {
            await this.lsClient.sendRequest(
                "powerquery/removeLibrarySymbols",
                {
                    librariesToRemove,
                },
                token,
            );
        } else {
            this.lsClient.error("Received removeLibrarySymbols call but client is not running.", undefined, false);
        }
    }
}
