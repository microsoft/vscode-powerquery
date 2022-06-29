// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { DefaultServerSettings, ServerSettings } from "./settings";
import { CancellationTokenUtils } from "../cancellationToken";
import { LibraryUtils } from "../library";

const LanguageId: string = "powerquery";

let serverSettings: ServerSettings = DefaultServerSettings;
let hasConfigurationCapability: boolean = false;

export async function initializeServerSettings(connection: LS.Connection): Promise<void> {
    serverSettings = await fetchConfigurationSettings(connection);
}

export function createAnalysisSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
    cancellationToken: LS.CancellationToken | undefined,
): PQLS.AnalysisSettings {
    return {
        createInspectionSettingsFn: (): PQLS.InspectionSettings =>
            createInspectionSettings(library, traceManager, cancellationToken),
        library,
        isWorkspaceCacheAllowed: serverSettings.isWorkspaceCacheAllowed,
        symbolProviderTimeoutInMS: serverSettings.symbolTimeoutInMs,
        traceManager,
        maybeInitialCorrelationId: undefined,
    };
}

export function createInspectionSettings(
    library: PQLS.Library.ILibrary,
    traceManager: PQP.Trace.TraceManager,
    cancellationToken: LS.CancellationToken | undefined,
): PQLS.InspectionSettings {
    return PQLS.InspectionUtils.createInspectionSettings(
        {
            ...PQP.DefaultSettings,
            locale: serverSettings.locale,
            traceManager,
            maybeCancellationToken: cancellationToken
                ? CancellationTokenUtils.createAdapter(cancellationToken, serverSettings.globalTimeoutInMs)
                : CancellationTokenUtils.createTimedCancellation(serverSettings.globalTimeoutInMs),
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
    cancellationToken: LS.CancellationToken | undefined,
): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library, traceManager, cancellationToken),
        LanguageId,
        {
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
    const maybeTypeStrategy: PQLS.TypeStrategy | undefined = config?.diagnostics?.typeStrategy;
    const experimental: boolean = config?.general?.experimental;

    return {
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: false,
        experimental,
        globalTimeoutInMs: config?.timeout?.globalTimeoutInMs,
        isBenchmarksEnabled: config?.benchmark?.enable ?? false,
        isWorkspaceCacheAllowed: config?.diagnostics?.isWorkspaceCacheAllowed ?? true,
        locale: config?.general?.locale ?? PQP.DefaultLocale,
        mode: deriveMode(config?.general?.mode),
        symbolTimeoutInMs: config?.timeout?.symbolTimeoutInMs,
        typeStrategy: maybeTypeStrategy ? deriveTypeStrategy(maybeTypeStrategy) : PQLS.TypeStrategy.Primitive,
    };
}

export function getServerSettings(): ServerSettings {
    return serverSettings;
}

export function getLocalizedLibrary(): PQLS.Library.ILibrary {
    switch (serverSettings.mode) {
        case "SDK":
            return LibraryUtils.getOrCreateSdkLibrary(serverSettings.locale);

        case "Power Query":
            return LibraryUtils.getOrCreateStandardLibrary(serverSettings.locale);

        default:
            throw PQP.Assert.isNever(serverSettings.mode);
    }
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
