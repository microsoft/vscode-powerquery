// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface ClientSettings {
    additionalSymbolsDirectories: string[] | null;
    workspaceSymbolsDirectory: string | null;
}

export const DefaultClientSettings: ClientSettings = {
    additionalSymbolsDirectories: null,
    workspaceSymbolsDirectory: null,
};
