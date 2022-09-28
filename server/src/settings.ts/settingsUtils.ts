// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DefaultServerSettings, ServerSettings } from "./settings";
import { LibraryUtils, ModuleLibraries } from "../library";
import { CancellationTokenUtils } from "../cancellationToken";
import { LibraryDefinitionsGetter } from "../library/libraryTypeResolver";
import { ModuleLibraryTreeNode } from "../library/moduleLibraries";

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
    return PQLS.InspectionUtils.createInspectionSettings(
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
): PQLS.ValidationSettings {
    return PQLS.ValidationSettingsUtils.createValidationSettings(
        createInspectionSettings(library, traceManager),
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

export function getLocalizedModuleLibraryFromTextDocument(
    moduleLibraries: ModuleLibraries,
    document: TextDocument,
    updateCache: boolean = false,
): PQLS.Library.ILibrary {
    const externalLibraryDefinitionsGetters: LibraryDefinitionsGetter[] = [];

    // add the document into module library container, and we need to trace for its validation
    const closestModuleLibraryTreeNodeOfDefinitions: ModuleLibraryTreeNode =
        moduleLibraries.addOneTextDocument(document);

    // I do not believe there would be one m proj at the root of the file system
    if (!closestModuleLibraryTreeNodeOfDefinitions.isRoot) {
        externalLibraryDefinitionsGetters.push(closestModuleLibraryTreeNodeOfDefinitions.libraryDefinitionsGetter);
    }

    if (updateCache) {
        // for validation, we have to forcefully update localizedLibrary to ensure it keeps up to the latest
        closestModuleLibraryTreeNodeOfDefinitions.cache.localizedLibrary = getLocalizedLibrary(
            externalLibraryDefinitionsGetters,
        );
    } else {
        closestModuleLibraryTreeNodeOfDefinitions.cache.localizedLibrary =
            closestModuleLibraryTreeNodeOfDefinitions.cache.localizedLibrary ??
            getLocalizedLibrary(externalLibraryDefinitionsGetters);
    }

    return closestModuleLibraryTreeNodeOfDefinitions.cache.localizedLibrary;
}

export function getLocalizedLibrary(
    otherLibraryDefinitionsGetters: LibraryDefinitionsGetter[] = [],
): PQLS.Library.ILibrary {
    switch (serverSettings.mode) {
        case "SDK":
            return LibraryUtils.getOrCreateSdkLibrary(serverSettings.locale, otherLibraryDefinitionsGetters);

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
