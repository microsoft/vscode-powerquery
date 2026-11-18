// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CancellationTokenSource, Disposable, LSPErrorCodes, ResponseError } from "vscode-languageserver/node";
import { expect } from "chai";

import { runSafeAsync, RuntimeEnvironment } from "../eventHandlerUtils";

function createRuntime(): RuntimeEnvironment {
    return {
        timer: {
            setImmediate(callback: (...args: unknown[]) => void, ...args: unknown[]): Disposable {
                callback(...args);

                return { dispose: (): void => {} };
            },
            setTimeout(callback: (...args: unknown[]) => void, _ms: number, ...args: unknown[]): Disposable {
                callback(...args);

                return { dispose: (): void => {} };
            },
        },
        console: {
            error: (): void => {},
            log: (): void => {},
        },
    };
}

function expectCancellation(result: unknown): void {
    if (!(result instanceof ResponseError)) {
        throw new Error("Expected a response error");
    }

    expect(result.code).to.equal(LSPErrorCodes.RequestCancelled);
}

describe("eventHandlerUtils", () => {
    describe("runSafeAsync", () => {
        it("returns cancellation before executing the function", async () => {
            const source: CancellationTokenSource = new CancellationTokenSource();
            let wasExecuted: boolean = false;

            source.cancel();

            const result: string | ResponseError<void> = await runSafeAsync(
                createRuntime(),
                () => {
                    wasExecuted = true;

                    return Promise.resolve("success");
                },
                "fallback",
                "request failed",
                source.token,
            );

            expect(wasExecuted).to.equal(false);
            expectCancellation(result);
        });

        it("returns cancellation after successful execution", async () => {
            const source: CancellationTokenSource = new CancellationTokenSource();

            let complete: (value: string) => void = () => {
                throw new Error("Completion was not initialized");
            };

            const operation: Promise<string> = new Promise((resolve: (value: string) => void): void => {
                complete = resolve;
            });

            const resultPromise: Thenable<string | ResponseError<void>> = runSafeAsync(
                createRuntime(),
                () => operation,
                "fallback",
                "request failed",
                source.token,
            );

            source.cancel();
            complete("success");

            expectCancellation(await resultPromise);
        });

        it("returns cancellation when execution rejects after cancellation", async () => {
            const source: CancellationTokenSource = new CancellationTokenSource();

            let fail: (reason: Error) => void = () => {
                throw new Error("Failure was not initialized");
            };

            const operation: Promise<string> = new Promise(
                (_resolve: (value: string) => void, reject: (reason: Error) => void): void => {
                    fail = reject;
                },
            );

            const resultPromise: Thenable<string | ResponseError<void>> = runSafeAsync(
                createRuntime(),
                () => operation,
                "fallback",
                "request failed",
                source.token,
            );

            source.cancel();
            fail(new Error("request failed"));

            expectCancellation(await resultPromise);
        });
    });
});
