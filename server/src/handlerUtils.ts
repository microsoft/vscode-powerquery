// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CancellationToken, Disposable, LSPErrorCodes, ResponseError } from "vscode-languageserver/node";

interface RuntimeEnvironment {
    readonly timer: {
        setImmediate(callback: (...args: unknown[]) => void, ...args: unknown[]): Disposable;
        setTimeout(callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]): Disposable;
    };
}

const DefaultRuntimeEnvironment: RuntimeEnvironment = {
    timer: {
        setImmediate(callback: (...args: unknown[]) => void, ...args: unknown[]): Disposable {
            const handle: NodeJS.Timeout = setTimeout(callback, 0, ...args);

            return { dispose: () => clearTimeout(handle) };
        },
        setTimeout(callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]): Disposable {
            const handle: NodeJS.Timeout = setTimeout(callback, ms, ...args);

            return { dispose: () => clearTimeout(handle) };
        },
    },
};

export function runSafeAsync<T, E>(
    func: () => Thenable<T>,
    errorVal: T,
    errorMessage: string,
    token: CancellationToken,
): Thenable<T | ResponseError<E>> {
    return new Promise<T | ResponseError<E>>((resolve: (value: T | ResponseError<E>) => void) => {
        DefaultRuntimeEnvironment.timer.setImmediate(() => {
            if (token.isCancellationRequested) {
                resolve(cancelValue());

                return;
            }

            // eslint-disable-next-line promise/prefer-await-to-then
            return func().then(
                (result: T) => {
                    if (token.isCancellationRequested) {
                        resolve(cancelValue());
                    } else {
                        resolve(result);
                    }
                },
                (e: Error) => {
                    if (token.isCancellationRequested) {
                        resolve(cancelValue());
                    } else {
                        // TODO: use trace manager
                        console.error(formatError(errorMessage, e));

                        resolve(errorVal);
                    }
                },
            );
        });
    });
}

export function runSafe<T, E>(
    func: () => T,
    errorVal: T,
    errorMessage: string,
    token: CancellationToken,
): Thenable<T | ResponseError<E>> {
    return new Promise<T | ResponseError<E>>((resolve: (value: T | ResponseError<E>) => void) => {
        DefaultRuntimeEnvironment.timer.setImmediate(() => {
            if (token.isCancellationRequested) {
                resolve(cancelValue());
            } else {
                try {
                    const result: T = func();

                    if (token.isCancellationRequested) {
                        resolve(cancelValue());

                        return;
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    // TODO: use trace manager
                    console.error(formatError(errorMessage, e));
                    resolve(errorVal);
                }
            }
        });
    });
}

function cancelValue<E>(): ResponseError<E> {
    return new ResponseError<E>(LSPErrorCodes.RequestCancelled, "Request cancelled");
}

function formatError(message: string, err: unknown): string {
    if (err instanceof Error) {
        const error: Error = err as Error;

        return `formatError: ${message}: ${error.message}\n${error.stack}`;
    } else if (typeof err === "string") {
        return `formatError: ${message}: ${err}`;
    } else if (err && typeof err === "object" && "toString" in err) {
        return `formatError: ${message}: ${err.toString()}`;
    }

    return message;
}
