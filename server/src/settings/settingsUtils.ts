// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { DefaultServerSettings, ServerSettings } from "./settings";
import { LibrarySymbolUtils, LibraryUtils, ModuleLibraryUtils } from "../library";
import { CancellationTokenUtils } from "../cancellationToken";

const LanguageId: string = "powerquery";

let serverSettings: ServerSettings = DefaultServerSettings;
let hasConfigurationCapability: boolean = false;

export async function initializeServerSettings(connection: LS.Connection): Promise<void> {
    serverSettings = await fetchConfigurationSettings(connection);
}

export function createAnalysisSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
): PQLS.AnalysisSettings {
    return {
        inspectionSettings: createInspectionSettings(library, traceManager),
        isWorkspaceCacheAllowed: serverSettings.isWorkspaceCacheAllowed,
        traceManager,
        initialCorrelationId: undefined,
    };
}

export function createCancellationToken(cancellationToken: LS.CancellationToken | undefined): PQP.ICancellationToken {
    return CancellationTokenUtils.createAdapterOrTimedCancellation(cancellationToken, serverSettings.symbolTimeoutInMs);
}

export function createInspectionSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
): PQLS.InspectionSettings {
    return PQLS.InspectionUtils.inspectionSettings(
        {
            ...PQP.DefaultSettings,
            locale: serverSettings.locale,
            traceManager,
        },
        {
            library,
            isWorkspaceCacheAllowed: serverSettings.isWorkspaceCacheAllowed,
            typeStrategy: serverSettings.typeStrategy,
        },
    );
}

export function createValidationSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
    cancellationToken: PQP.ICancellationToken | undefined,
): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library, traceManager),
        LanguageId,
        {
            cancellationToken,
            checkForDuplicateIdentifiers: serverSettings.checkForDuplicateIdentifiers,
            checkInvokeExpressions: serverSettings.checkInvokeExpressions,
        },
    );
}

export async function fetchConfigurationSettings(connection: LS.Connection): Promise<ServerSettings> {
    if (!hasConfigurationCapability) {
        return DefaultServerSettings;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = await connection.workspace.getConfiguration({ section: "powerquery" });
    const typeStrategy: PQLS.TypeStrategy | undefined = config?.diagnostics?.typeStrategy;
    const experimental: boolean = config?.general?.experimental;

    return {
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: false,
        experimental,
        isBenchmarksEnabled: config?.benchmark?.enable ?? false,
        isWorkspaceCacheAllowed: config?.diagnostics?.isWorkspaceCacheAllowed ?? true,
        locale: config?.general?.locale ?? PQP.DefaultLocale,
        mode: deriveMode(config?.general?.mode),
        symbolTimeoutInMs: config?.timeout?.symbolTimeoutInMs,
        typeStrategy: typeStrategy ? deriveTypeStrategy(typeStrategy) : PQLS.TypeStrategy.Primitive,
    };
}

export function getServerSettings(): ServerSettings {
    return serverSettings;
}

export function getLibrary(uri: string): PQLS.Library.ILibrary {
    const cacheKey: string = LibraryUtils.createCacheKey(serverSettings.locale, serverSettings.mode);
    const result: PQLS.Library.ILibrary | undefined = LibraryUtils.getLibrary(cacheKey);

    if (result) {
        return result;
    }

    return LibraryUtils.createLibraryAndSetCache(
        cacheKey,
        [LibrarySymbolUtils.getSymbolsForLocaleAndMode(serverSettings.locale, serverSettings.mode)],
        [ModuleLibraryUtils.getAsDynamicLibraryDefinitions(uri)],
    );
}

export function getHasConfigurationCapability(): boolean {
    return hasConfigurationCapability;
}

export function setHasConfigurationCapability(value: boolean): void {
    hasConfigurationCapability = value;
}

function deriveMode(value: string | undefined): "Power Query" | "SDK" {
    switch (value) {
        case "SDK":
        case "Power Query":
            return value;

        default:
            return "Power Query";
    }
}

function deriveTypeStrategy(value: string): PQLS.TypeStrategy {
    switch (value) {
        case PQLS.TypeStrategy.Extended:
        case PQLS.TypeStrategy.Primitive:
            return value;

        default:
            throw new PQP.CommonError.InvariantError(`could not derive typeStrategy`);
    }
}
