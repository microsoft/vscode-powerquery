// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    LibraryDocumentationJson,
    LibraryExportJson,
    LibraryFieldJson,
    LibraryFunctionParameterJson,
    LibraryJson,
} from "./vscode-powerquery.api";

export function parseLibraryJson(json: string): LibraryJson {
    const parsed: unknown = JSON.parse(json);
    assertLibraryJson(parsed);

    return parsed;
}

// Type assertions for LibraryJson
export function assertLibraryJson(input: unknown): asserts input is LibraryJson {
    if (!Array.isArray(input)) {
        throw new Error("Invalid LibraryJson");
    }

    input.forEach(assertLibraryExportJson);
}

// Type assertions for LibraryExportJson
function assertLibraryExportJson(input: unknown): asserts input is LibraryExportJson {
    if (typeof input !== "object" || input === null) {
        throw new Error("Invalid LibraryExportJson");
    }

    const obj: Record<string, unknown> = input as Record<string, unknown>;

    if (typeof obj.name !== "string") {
        throw new Error("Invalid name in LibraryExportJson");
    }

    if (obj.documentation !== null && obj.documentation !== undefined) {
        assertLibraryDocumentationJson(obj.documentation);
    }

    if (obj.functionParameters !== null && obj.functionParameters !== undefined) {
        if (!Array.isArray(obj.functionParameters)) {
            throw new Error("Invalid functionParameters in LibraryExportJson");
        }

        obj.functionParameters.forEach(assertLibraryFunctionParameterJson);
    }

    if (typeof obj.completionItemType !== "number") {
        throw new Error("Invalid completionItemType in LibraryExportJson");
    }

    if (typeof obj.isDataSource !== "boolean") {
        throw new Error("Invalid isDataSource in LibraryExportJson");
    }

    if (typeof obj.dataType !== "string") {
        throw new Error("Invalid dataType in LibraryExportJson");
    }
}

// Type assertions for LibraryDocumentationJson
function assertLibraryDocumentationJson(input: unknown): asserts input is LibraryDocumentationJson {
    if (typeof input !== "object" || input === null) {
        throw new Error("Invalid LibraryDocumentationJson");
    }

    const obj: Record<string, unknown> = input as Record<string, unknown>;

    if (obj.description !== null && typeof obj.description !== "string") {
        throw new Error("Invalid description in LibraryDocumentationJson");
    }

    if (obj.longDescription !== null && typeof obj.longDescription !== "string") {
        throw new Error("Invalid longDescription in LibraryDocumentationJson");
    }

    if (obj.category !== null && typeof obj.category !== "string") {
        throw new Error("Invalid category in LibraryDocumentationJson");
    }
}

// Type assertions for LibraryFunctionParameterJson
function assertLibraryFunctionParameterJson(input: unknown): asserts input is LibraryFunctionParameterJson {
    if (typeof input !== "object" || input === null) {
        throw new Error("Invalid LibraryFunctionParameterJson");
    }

    const obj: Record<string, unknown> = input as Record<string, unknown>;

    if (typeof obj.name !== "string") {
        throw new Error("Invalid name in LibraryFunctionParameterJson");
    }

    if (typeof obj.parameterType !== "string") {
        throw new Error("Invalid parameterType in LibraryFunctionParameterJson");
    }

    if (typeof obj.isRequired !== "boolean") {
        throw new Error("Invalid isRequired in LibraryFunctionParameterJson");
    }

    if (typeof obj.isNullable !== "boolean") {
        throw new Error("Invalid isNullable in LibraryFunctionParameterJson");
    }

    if (obj.caption !== null && typeof obj.caption !== "string") {
        throw new Error("Invalid caption in LibraryFunctionParameterJson");
    }

    if (obj.description !== null && typeof obj.description !== "string") {
        throw new Error("Invalid description in LibraryFunctionParameterJson");
    }

    if (obj.sampleValues !== null && !Array.isArray(obj.sampleValues)) {
        throw new Error("Invalid sampleValues in LibraryFunctionParameterJson");
    }

    if (obj.allowedValues !== null && !Array.isArray(obj.allowedValues)) {
        throw new Error("Invalid allowedValues in LibraryFunctionParameterJson");
    }

    if (obj.defaultValue !== null && typeof obj.defaultValue !== "string" && typeof obj.defaultValue !== "number") {
        throw new Error("Invalid defaultValue in LibraryFunctionParameterJson");
    }

    if (obj.fields !== null) {
        if (!Array.isArray(obj.fields)) {
            throw new Error("Invalid fields in LibraryFunctionParameterJson");
        }

        obj.fields.forEach(assertLibraryFieldJson);
    }

    if (obj.enumNames !== null && !Array.isArray(obj.enumNames)) {
        throw new Error("Invalid enumNames in LibraryFunctionParameterJson");
    }

    if (obj.enumCaptions !== null && !Array.isArray(obj.enumCaptions)) {
        throw new Error("Invalid enumCaptions in LibraryFunctionParameterJson");
    }
}

// Type assertions for LibraryFieldJson
function assertLibraryFieldJson(input: unknown): asserts input is LibraryFieldJson {
    if (typeof input !== "object" || input === null) {
        throw new Error("Invalid LibraryFieldJson");
    }

    const obj: Record<string, unknown> = input as Record<string, unknown>;

    if (typeof obj.fieldName !== "string") {
        throw new Error("Invalid fieldName in LibraryFieldJson");
    }

    if (typeof obj.type !== "string") {
        throw new Error("Invalid type in LibraryFieldJson");
    }

    if (typeof obj.isRequired !== "boolean") {
        throw new Error("Invalid isRequired in LibraryFieldJson");
    }

    if (obj.fieldCaption !== null && typeof obj.fieldCaption !== "string") {
        throw new Error("Invalid fieldCaption in LibraryFieldJson");
    }

    if (obj.fieldDescription !== null && typeof obj.fieldDescription !== "string") {
        throw new Error("Invalid fieldDescription in LibraryFieldJson");
    }
}
