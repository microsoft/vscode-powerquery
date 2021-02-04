// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as PQLS from "@microsoft/powerquery-language-services";

import { FunctionName } from "./functionName";

export function externalTypeResolverFnFactory(
    library: PQLS.Library.Library,
): PQP.Language.ExternalType.TExternalTypeResolverFn {
    const libraryMap: LibraryMap = createLibraryMap(library);

    return (request: PQP.Language.ExternalType.TExternalTypeRequest) => {
        const identifierLiteral: string = request.identifierLiteral;

        const maybeExteranlTypeTrio: TExternalTypeTrio | undefined = libraryMap.get(identifierLiteral);
        if (maybeExteranlTypeTrio === undefined) {
            return undefined;
        }
        const externalTypeTrio: TExternalTypeTrio = maybeExteranlTypeTrio;
        const value: PQP.Language.Type.TType = externalTypeTrio.value;

        switch (request.kind) {
            case PQP.Language.ExternalType.ExternalTypeRequestKind.Invocation:
                return externalTypeTrio.kind === ExternalTypeTrioKind.Invocation &&
                    PQP.Language.TypeUtils.isValidInvocation(externalTypeTrio.value, request.args)
                    ? externalTypeTrio.invocationResolverFn(request)
                    : undefined;

            case PQP.Language.ExternalType.ExternalTypeRequestKind.Value:
                return value;

            default:
                throw PQP.Assert.isNever(request);
        }
    };
}

function createLibraryMap(library: PQLS.Library.Library): LibraryMap {
    const result: Map<string, TExternalTypeTrio> = new Map();

    for (const exteranlTypeTrio of ExternalTypeTrios) {
        if (isExternalTypeTrioInLibrary(library, exteranlTypeTrio)) {
            result.set(exteranlTypeTrio.identifierLiteral, exteranlTypeTrio);
        }
    }

    return result;
}

function isExternalTypeTrioInLibrary(library: PQLS.Library.Library, externalTypeTrio: TExternalTypeTrio): boolean {
    return library.has(externalTypeTrio.identifierLiteral);
}

function resolveTableAddColumn(
    request: PQP.Language.ExternalType.ExternalInvocationTypeRequest,
): PQP.Language.Type.TTable | PQP.Language.Type.None | undefined {
    const table: PQP.Language.Type.TType = PQP.Language.TypeUtils.assertAsTable(PQP.Assert.asDefined(request.args[0]));
    const columnName: PQP.Language.Type.TText = PQP.Language.TypeUtils.assertAsText(
        PQP.Assert.asDefined(request.args[1]),
    );
    const columnGenerator: PQP.Language.Type.TFunction = PQP.Language.TypeUtils.assertAsFunction(
        PQP.Assert.asDefined(request.args[2]),
    );
    const maybeColumnType: PQP.Language.Type.TType | undefined =
        request.args.length === 4
            ? PQP.Language.TypeUtils.assertAsType(PQP.Assert.asDefined(request.args[3]))
            : undefined;

    // We can't mutate the given table without being able to resolve columnName to a literal.
    if (!PQP.Language.TypeUtils.isTextLiteral(columnName)) {
        return undefined;
    }

    let columnType: PQP.Language.Type.TType;
    if (maybeColumnType !== undefined) {
        columnType = maybeColumnType;
    } else if (PQP.Language.TypeUtils.isDefinedFunction(columnGenerator)) {
        columnType = columnGenerator.returnType;
    } else {
        columnType = PQP.Language.Type.AnyInstance;
    }

    if (PQP.Language.TypeUtils.isDefinedTable(table)) {
        // We can't overwrite an existing key.
        if (table.fields.has(PQP.StringUtils.normalizeIdentifier(columnName.literal))) {
            return PQP.Language.Type.NoneInstance;
        }

        return PQP.Language.TypeUtils.definedTableFactory(
            table.isNullable,
            new Map<string, PQP.Language.Type.TType>([...table.fields.entries(), [columnName.literal, columnType]]),
            table.isOpen,
        );
    } else {
        return PQP.Language.TypeUtils.definedTableFactory(
            table.isNullable,
            new Map<string, PQP.Language.Type.TType>([[columnName.literal, columnType]]),
            true,
        );
    }
}

type LibraryMap = Map<string, TExternalTypeTrio>;

type TExternalTypeTrio = ExteranlInvocationTrio | ExteranlValueTrio;

const enum ExternalTypeTrioKind {
    Invocation = "Invocation",
    Value = "Value",
}

interface IExternalTypeTrio {
    readonly kind: ExternalTypeTrioKind;
    readonly identifierLiteral: string;
    readonly value: PQP.Language.Type.TType;
}

interface ExteranlInvocationTrio extends IExternalTypeTrio {
    readonly kind: ExternalTypeTrioKind.Invocation;
    readonly value: PQP.Language.Type.DefinedFunction;
    readonly invocationResolverFn: (
        request: PQP.Language.ExternalType.ExternalInvocationTypeRequest,
    ) => PQP.Language.Type.TType | undefined;
}

interface ExteranlValueTrio extends IExternalTypeTrio {
    readonly kind: ExternalTypeTrioKind.Value;
}

const TableAddColumnType: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.definedFunctionFactory(
    false,
    [
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Table,
            nameLiteral: "table",
        },
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Text,
            nameLiteral: "newColumnName",
        },
        {
            isNullable: false,
            isOptional: false,
            maybeType: PQP.Language.Type.TypeKind.Function,
            nameLiteral: "columnGenerator",
        },
        {
            isNullable: true,
            isOptional: true,
            maybeType: PQP.Language.Type.TypeKind.Type,
            nameLiteral: "type",
        },
    ],
    PQP.Language.Type.TableInstance,
);

const ExternalTypeTrios: ReadonlyArray<TExternalTypeTrio> = [
    {
        kind: ExternalTypeTrioKind.Invocation,
        identifierLiteral: FunctionName.TableAddColumn,
        value: TableAddColumnType,
        invocationResolverFn: resolveTableAddColumn,
    },
];
