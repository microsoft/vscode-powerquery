// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

export interface ServerSettings {
    checkForDuplicateIdentifiers: boolean;
    checkInvokeExpressions: boolean;
    experimental: boolean;
    isBenchmarksEnabled: boolean;
    isWorkspaceCacheAllowed: boolean;
    locale: string;
    mode: "Power Query" | "SDK";
    symbolTimeoutInMs: number;
    globalTimeoutInMs: number;
    typeStrategy: PQLS.TypeStrategy;
}

export const DefaultServerSettings: ServerSettings = {
    checkForDuplicateIdentifiers: true,
    checkInvokeExpressions: false,
    experimental: false,
    isBenchmarksEnabled: false,
    isWorkspaceCacheAllowed: true,
    locale: PQP.DefaultLocale,
    mode: "Power Query",
    symbolTimeoutInMs: 2000,
    globalTimeoutInMs: 5000,
    typeStrategy: PQLS.TypeStrategy.Primitive,
};
