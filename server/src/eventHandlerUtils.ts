// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    CancellationToken,
    Disposable,
    ErrorCodes,
    GenericRequestHandler,
    LSPErrorCodes,
    RemoteConsole,
    ResponseError,
} from "vscode-languageserver/node";

export interface RuntimeEnvironment {
    readonly timer: {
        readonly setImmediate: (callback: (...args: unknown[]) => void, ...args: unknown[]) => Disposable;
        readonly setTimeout: (callback: (...args: unknown[]) => void, ms: number, ...args: unknown[]) => Disposable;
    };
    readonly console: RemoteConsole;
}

export function genericRequestHandler<T, R>(func: (params: T) => R): GenericRequestHandler<R, unknown> {
    const handler: GenericRequestHandler<R, unknown> = (params: T): R | ResponseError<unknown> => {
        try {
            return func(params);
        } catch (error: unknown) {
            return new ResponseError(
                ErrorCodes.InternalError,
                error instanceof Error ? error.message : "An unknown error occurred",
                error,
            );
        }
    };

    return handler;
}

export function runSafeAsync<T, E>(
    runtime: RuntimeEnvironment,
    func: () => Thenable<T>,
    errorVal: T,
    errorMessage: string,
    token: CancellationToken,
): Thenable<T | ResponseError<E>> {
    return new Promise<T | ResponseError<E>>((resolve: (value: T | ResponseError<E>) => void) => {
        runtime.timer.setImmediate(() => {
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
                    runtime.console.error(formatError(errorMessage, e));
                    resolve(errorVal);
                },
            );
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
