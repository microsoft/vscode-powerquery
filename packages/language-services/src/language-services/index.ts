// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TextDocument } from "vscode-languageserver-types";

import * as WorkspaceCache from "./workspaceCache";

export function documentUpdated(document: TextDocument): void {
    WorkspaceCache.update(document);
}

export function documentClosed(document: TextDocument): void {
    WorkspaceCache.close(document);
}

export * from "./symbolProviders";
export * from "./validation";
