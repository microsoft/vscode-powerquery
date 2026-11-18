// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import assert from "assert";

import { LibrarySymbolClient, MinimalPowerQueryLanguageServiceClient } from "../../librarySymbolClient";
import { LibraryJson } from "../../powerQueryApi";

suite("LibrarySymbolClient.onModuleLibraryUpdated", () => {
    test("Propagates request failures", async () => {
        const requestError: Error = new Error("Request failed");

        const languageClient: MinimalPowerQueryLanguageServiceClient = {
            sendRequest: (_method: string, _params?: unknown): Promise<unknown> => Promise.reject(requestError),
            isRunning: (): boolean => true,
            info: (): void => undefined,
            error: (): void => undefined,
        };

        const client: LibrarySymbolClient = new LibrarySymbolClient(languageClient);

        const library: LibraryJson = [];

        await assert.rejects(client.onModuleLibraryUpdated("file:///workspace", library), requestError);
    });

    test("Does not send requests while the language client is stopped", async () => {
        let requestCount: number = 0;
        let loggedError: string | undefined;

        const languageClient: MinimalPowerQueryLanguageServiceClient = {
            sendRequest: (_method: string, _params?: unknown): Promise<unknown> => {
                requestCount += 1;

                return Promise.resolve();
            },
            isRunning: (): boolean => false,
            info: (): void => undefined,
            error: (message: string): void => {
                loggedError = message;
            },
        };

        const client: LibrarySymbolClient = new LibrarySymbolClient(languageClient);

        await client.onModuleLibraryUpdated("file:///workspace", []);

        assert.equal(requestCount, 0);

        assert.equal(loggedError, "Received moduleLibraryUpdated call but client is not running.");
    });
});
