// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Generated with https://app.quicktype.io/

/* eslint-disable */

//////////////////////////////
// Replace everything below
//////////////////////////////

// To parse this data:
//
//   import { Convert } from "./file";
//
//   const libraryExportJSON = Convert.toLibraryExportJSON(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export type LibraryExportJSON = {
    name: string;
    documentation: Documentation | null;
    functionParameters: FunctionParameter[] | null;
    completionItemKind: number;
    isDataSource: boolean;
    type: Type;
};

export type Documentation = {
    description: null | string;
    longDescription: null;
    category: null | string;
};

export type FunctionParameter = {
    name: string;
    type: Type;
    isRequired: boolean;
    isNullable: boolean;
    caption: null;
    description: null;
    sampleValues: null;
    allowedValues: number[] | null;
    defaultValue: null;
    fields: Field[] | null;
    enumNames: string[] | null;
    enumCaptions: null[] | null;
};

export type Field = {
    name: string;
    type: Type;
    isRequired: boolean;
    caption: null;
    description: null;
};

export type Type =
    | "any"
    | "number"
    | "binary"
    | "nullable record"
    | "function"
    | "list {any}"
    | "action"
    | "nullable action"
    | "record"
    | "nullable text"
    | "text"
    | "nullable binary"
    | "nullable number"
    | "nullable type"
    | "nullable function"
    | "table"
    | "nullable logical"
    | "list {text}"
    | "nullable list {any}"
    | "date"
    | "nullable date"
    | "nullable datetime"
    | "datetime"
    | "nullable datetimezone"
    | "datetimezone"
    | "anynonnull"
    | "nullable duration"
    | "duration"
    | "type"
    | "list {function}"
    | "time"
    | "logical"
    | "nullable table"
    | "nullable time"
    | "nullable list {text}"
    | "list {record}";

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toLibraryExportJSON(json: string): LibraryExportJSON[] {
        return cast(JSON.parse(json), a(r("LibraryExportJSON")));
    }

    public static libraryExportJSONToJson(value: LibraryExportJSON[]): string {
        return JSON.stringify(uncast(value, a(r("LibraryExportJSON"))), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : "";
    const keyText = key ? ` for key "${key}"` : "";
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ
                .map(a => {
                    return prettyTypeName(a);
                })
                .join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = "", parent: any = ""): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(
            cases.map(a => {
                return l(a);
            }),
            val,
            key,
            parent,
        );
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers")
            ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")
            ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")
            ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    LibraryExportJSON: o(
        [
            { json: "name", js: "name", typ: "" },
            { json: "documentation", js: "documentation", typ: u(r("Documentation"), null) },
            { json: "functionParameters", js: "functionParameters", typ: u(a(r("FunctionParameter")), null) },
            { json: "completionItemKind", js: "completionItemKind", typ: 0 },
            { json: "isDataSource", js: "isDataSource", typ: true },
            { json: "type", js: "type", typ: r("Type") },
        ],
        false,
    ),
    Documentation: o(
        [
            { json: "description", js: "description", typ: u(null, "") },
            { json: "longDescription", js: "longDescription", typ: null },
            { json: "category", js: "category", typ: u(null, "") },
        ],
        false,
    ),
    FunctionParameter: o(
        [
            { json: "name", js: "name", typ: "" },
            { json: "type", js: "type", typ: r("Type") },
            { json: "isRequired", js: "isRequired", typ: true },
            { json: "isNullable", js: "isNullable", typ: true },
            { json: "caption", js: "caption", typ: null },
            { json: "description", js: "description", typ: null },
            { json: "sampleValues", js: "sampleValues", typ: null },
            { json: "allowedValues", js: "allowedValues", typ: u(a(0), null) },
            { json: "defaultValue", js: "defaultValue", typ: null },
            { json: "fields", js: "fields", typ: u(a(r("Field")), null) },
            { json: "enumNames", js: "enumNames", typ: u(a(""), null) },
            { json: "enumCaptions", js: "enumCaptions", typ: u(a(null), null) },
        ],
        false,
    ),
    Field: o(
        [
            { json: "name", js: "name", typ: "" },
            { json: "type", js: "type", typ: r("Type") },
            { json: "isRequired", js: "isRequired", typ: true },
            { json: "caption", js: "caption", typ: null },
            { json: "description", js: "description", typ: null },
        ],
        false,
    ),
    Type: [
        "action",
        "any",
        "anynonnull",
        "binary",
        "date",
        "datetime",
        "datetimezone",
        "duration",
        "function",
        "list {any}",
        "list {function}",
        "list {record}",
        "list {text}",
        "logical",
        "nullable action",
        "nullable binary",
        "nullable date",
        "nullable datetime",
        "nullable datetimezone",
        "nullable duration",
        "nullable function",
        "nullable list {any}",
        "nullable list {text}",
        "nullable logical",
        "nullable number",
        "nullable record",
        "nullable table",
        "nullable text",
        "nullable time",
        "nullable type",
        "number",
        "record",
        "table",
        "text",
        "time",
        "type",
    ],
};
