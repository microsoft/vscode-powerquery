// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver";

import { TextDocument } from "vscode-languageserver-textdocument";

import { CancellationTokenShim } from "./cancellationTokenShim";

// Map<function name, Map<uri, version>>
const versionTrackers: Map<string, Map<string, number>> = new Map();

export function create(
    fnName: string,
    textDocument: TextDocument,
    lsCancellationToken: LS.CancellationToken,
): CancellationTokenShim {
    return new CancellationTokenShim(textDocument.version, lsCancellationToken, () => {
        const maybeTrackerForFnName: Map<string, number> | undefined = versionTrackers.get(fnName);

        // Has a value been set for the given fnName?
        // If not, create a new Map entry and return itself as the latest version.
        if (maybeTrackerForFnName === undefined) {
            versionTrackers.set(
                fnName,
                new Map<string, number>([[textDocument.uri, textDocument.version]]),
            );

            return textDocument.version;
        } else {
            const maybeVersionForUri: number | undefined = maybeTrackerForFnName.get(textDocument.uri);

            // Has a value been set for the given TextDocument.uri?
            // If not, create a new Map entry and return itself as the latest version.
            if (maybeVersionForUri === undefined) {
                maybeTrackerForFnName.set(textDocument.uri, textDocument.version);
                return textDocument.version;
            } else {
                return maybeVersionForUri;
            }
        }
    });
}
