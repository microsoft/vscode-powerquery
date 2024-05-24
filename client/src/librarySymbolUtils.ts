// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    LibraryJson,
    LibrarySymbol,
    LibrarySymbolDocumentation,
    LibrarySymbolFunctionParameter,
    LibrarySymbolRecordField,
} from "./powerQueryApi";

export function parseLibraryJson(json: string): LibraryJson {
    const parsed: unknown = JSON.parse(json);
    assertLibraryJson(parsed);

    return parsed;
}

function assertLibraryJson(json: unknown): asserts json is LibraryJson {
    assertIsArray(json);
    json.forEach(assertLibrarySymbol);
}

function assertLibrarySymbol(symbol: unknown): asserts symbol is LibrarySymbol {
    assertIsObject(symbol);
    assertHasProperty(symbol, "name", "string");
    assertHasProperty(symbol, "documentation", "object", true);
    assertHasProperty(symbol, "functionParameters", "object", true);
    assertHasProperty(symbol, "completionItemKind", "number");
    assertHasProperty(symbol, "isDataSource", "boolean");
    assertHasProperty(symbol, "type", "string");

    const librarySymbol: LibrarySymbol = symbol as LibrarySymbol;

    if (librarySymbol.documentation !== null && librarySymbol.documentation !== undefined) {
        assertLibrarySymbolDocumentation(librarySymbol.documentation);
    }

    if (librarySymbol.functionParameters !== null && librarySymbol.functionParameters !== undefined) {
        assertIsArray(librarySymbol.functionParameters);
        librarySymbol.functionParameters.forEach(assertLibrarySymbolFunctionParameter);
    }
}

function assertLibrarySymbolDocumentation(doc: unknown): asserts doc is LibrarySymbolDocumentation {
    assertIsObject(doc);
    assertHasProperty(doc, "description", "string", true);
    assertHasProperty(doc, "longDescription", "string", true);
}

function assertLibrarySymbolFunctionParameter(param: unknown): asserts param is LibrarySymbolFunctionParameter {
    assertIsObject(param);
    assertHasProperty(param, "name", "string");
    assertHasProperty(param, "type", "string");
    assertHasProperty(param, "isRequired", "boolean");
    assertHasProperty(param, "isNullable", "boolean");
    assertHasProperty(param, "caption", "string", true);
    assertHasProperty(param, "description", "string", true);
    assertHasProperty(param, "sampleValues", "object", true);
    assertHasProperty(param, "allowedValues", "object", true);
    assertHasProperty(param, "defaultValue", "object", true);
    assertHasProperty(param, "fields", "object", true);
    assertHasProperty(param, "enumNames", "object", true);
    assertHasProperty(param, "enumCaptions", "object", true);

    const functionParam: LibrarySymbolFunctionParameter = param as LibrarySymbolFunctionParameter;

    if (functionParam.sampleValues !== null && functionParam.sampleValues !== undefined) {
        assertIsArray(functionParam.sampleValues);
    }

    if (functionParam.allowedValues !== null && functionParam.allowedValues !== undefined) {
        assertIsArray(functionParam.allowedValues);
    }

    if (functionParam.fields !== null && functionParam.fields !== undefined) {
        assertIsArray(functionParam.fields);
        functionParam.fields.forEach(assertLibrarySymbolRecordField);
    }

    if (functionParam.enumNames !== null && functionParam.enumNames !== undefined) {
        assertIsArray(functionParam.enumNames);
    }

    if (functionParam.enumCaptions !== null && functionParam.enumCaptions !== undefined) {
        assertIsArray(functionParam.enumCaptions);
    }
}

function assertLibrarySymbolRecordField(field: unknown): asserts field is LibrarySymbolRecordField {
    assertIsObject(field);
    assertHasProperty(field, "name", "string");
    assertHasProperty(field, "type", "string");
    assertHasProperty(field, "isRequired", "boolean");
    assertHasProperty(field, "caption", "string", true);
    assertHasProperty(field, "description", "string", true);
}

// Helper functions
function assertIsArray(value: unknown): asserts value is Array<unknown> {
    if (!Array.isArray(value)) {
        throw new TypeError("Expected an array");
    }
}

function assertIsObject(value: unknown): asserts value is object {
    if (typeof value !== "object" || value === null) {
        throw new TypeError("Expected an object");
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertHasProperty(obj: any, propName: string, type: string, optional: boolean = false): void {
    if (!(propName in obj)) {
        if (!optional) {
            throw new TypeError(`Missing property: ${propName}`);
        }
    } else if (typeof obj[propName] !== type && obj[propName] !== null && obj[propName] !== undefined) {
        throw new TypeError(`Expected property type ${type} for property ${propName}`);
    }
}
