// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";

/**
 * Request deduplication and debouncing utilities for LSP operations
 */
export class RequestManager {
    private readonly pendingRequests: Map<string, Promise<unknown>> = new Map();
    private readonly debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly DEFAULT_DEBOUNCE_MS: number = 300;

    /**
     * Deduplicates requests by key - if a request with the same key is already pending,
     * returns the existing promise instead of starting a new one
     */
    deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
        const existingRequest: Promise<unknown> | undefined = this.pendingRequests.get(key);

        if (existingRequest) {
            return existingRequest as Promise<T>;
        }

        const promise: Promise<T> = this.executeWithCleanup(key, requestFn);
        this.pendingRequests.set(key, promise);

        return promise;
    }

    private async executeWithCleanup<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
        try {
            return await requestFn();
        } finally {
            this.pendingRequests.delete(key);
        }
    }

    /**
     * Debounces requests by key - delays execution until no new requests with the same key
     * have been made for the specified time
     */
    debounceRequest<T>(
        key: string,
        requestFn: () => Promise<T>,
        debounceMs: number = this.DEFAULT_DEBOUNCE_MS,
    ): Promise<T> {
        return new Promise<T>((resolve: (value: T) => void, reject: (reason?: unknown) => void) => {
            // Clear existing timer for this key
            const existingTimer: NodeJS.Timeout | undefined = this.debounceTimers.get(key);

            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Set new timer
            const timer: NodeJS.Timeout = setTimeout(async () => {
                this.debounceTimers.delete(key);

                try {
                    const result: T = await requestFn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, debounceMs);

            this.debounceTimers.set(key, timer);
        });
    }

    /**
     * Combines debouncing and deduplication
     */
    debouncedDeduplicatedRequest<T>(
        key: string,
        requestFn: () => Promise<T>,
        debounceMs: number = this.DEFAULT_DEBOUNCE_MS,
    ): Promise<T> {
        return this.deduplicateRequest(key, () => this.debounceRequest(`debounced_${key}`, requestFn, debounceMs));
    }

    /**
     * Cancels all pending debounced requests
     */
    cancelAllDebounced(): void {
        for (const [key, timer] of this.debounceTimers) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }
    }

    /**
     * Cancels debounced requests for a specific key pattern
     */
    cancelDebounced(keyPattern: string): void {
        for (const [key, timer] of this.debounceTimers) {
            if (key.includes(keyPattern)) {
                clearTimeout(timer);
                this.debounceTimers.delete(key);
            }
        }
    }

    /**
     * Gets the count of pending requests
     */
    getPendingRequestsCount(): number {
        return this.pendingRequests.size;
    }

    /**
     * Gets the count of debounced requests
     */
    getDebouncedRequestsCount(): number {
        return this.debounceTimers.size;
    }

    /**
     * Creates a key for document-based operations
     */
    static createDocumentKey(uri: string, operation: string, version?: number): string {
        return `${operation}:${uri}${version !== undefined ? `:v${version}` : ""}`;
    }

    /**
     * Creates a key for position-based operations
     */
    static createPositionKey(uri: string, operation: string, position: LS.Position, version?: number): string {
        return `${operation}:${uri}:${position.line}:${position.character}${
            version !== undefined ? `:v${version}` : ""
        }`;
    }
}

// Global request manager instance
const globalRequestManager: RequestManager = new RequestManager();

export { globalRequestManager };
