// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";

/**
 * Enhanced cancellation utilities for better LSP operation cancellation
 */
export class CancellationUtils {
    private static readonly CHECK_INTERVAL_MS: number = 100; // Check cancellation every 100ms

    /**
     * Throws if the cancellation token is cancelled
     */
    static throwIfCancelled(cancellationToken: LS.CancellationToken): void {
        if (cancellationToken.isCancellationRequested) {
            throw new Error("Operation was cancelled");
        }
    }

    /**
     * Runs a long operation with periodic cancellation checks
     */
    static async withPeriodicCancellationCheck<T>(
        operation: () => Promise<T>,
        cancellationToken: LS.CancellationToken,
        checkIntervalMs: number = CancellationUtils.CHECK_INTERVAL_MS,
    ): Promise<T> {
        const checkCancellation: () => void = (): void => {
            if (cancellationToken.isCancellationRequested) {
                throw new Error("Operation was cancelled");
            }
        };

        // Set up periodic cancellation checks
        const intervalId: NodeJS.Timeout = setInterval(checkCancellation, checkIntervalMs);

        try {
            checkCancellation(); // Check immediately
            const result: T = await operation();

            checkCancellation(); // Check after completion

            return result;
        } finally {
            clearInterval(intervalId);
        }
    }

    /**
     * Creates a promise that rejects when cancellation is requested
     */
    static createCancellationPromise(cancellationToken: LS.CancellationToken): Promise<never> {
        return new Promise((_resolve: (value: never) => void, reject: (reason?: unknown) => void) => {
            if (cancellationToken.isCancellationRequested) {
                reject(new Error("Operation was cancelled"));

                return;
            }

            const listener: LS.Disposable = cancellationToken.onCancellationRequested(() => {
                listener.dispose();
                reject(new Error("Operation was cancelled"));
            });
        });
    }

    /**
     * Races an operation against cancellation
     */
    static raceWithCancellation<T>(operation: Promise<T>, cancellationToken: LS.CancellationToken): Promise<T> {
        const cancellationPromise: Promise<never> = CancellationUtils.createCancellationPromise(cancellationToken);

        return Promise.race([operation, cancellationPromise]);
    }
}
