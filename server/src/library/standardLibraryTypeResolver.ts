// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

import { FunctionName } from "./functionName";

export function createStandardLibraryTypeResolver(
    libraryDefinitions: PQLS.Library.LibraryDefinitions,
): PQLS.Inspection.ExternalType.TExternalTypeResolverFn {
    return (request: PQLS.Inspection.ExternalType.TExternalTypeRequest) => {
        const maybeDuo: SpecializedDuo | undefined = SpecializedDuoResolvers.get(request.identifierLiteral);
        if (maybeDuo !== undefined) {
            return resolveSpecializedDuo(request, maybeDuo);
        } else if (request.kind === PQLS.Inspection.ExternalType.ExternalTypeRequestKind.Value) {
            return libraryDefinitions.get(request.identifierLiteral)?.asPowerQueryType;
        } else {
            return undefined;
        }
    };
}

function resolveSpecializedDuo(
    request: PQLS.Inspection.ExternalType.TExternalTypeRequest,
    specializedDuo: SpecializedDuo,
): PQP.Language.Type.PowerQueryType | undefined {
    switch (request.kind) {
        case PQLS.Inspection.ExternalType.ExternalTypeRequestKind.Invocation:
            return specializedDuo.invocationResolverFn(request);

        case PQLS.Inspection.ExternalType.ExternalTypeRequestKind.Value:
            return specializedDuo.value;

        default:
            throw PQP.Assert.isNever(request);
    }
}

function resolveTableAddColumn(
    request: PQLS.Inspection.ExternalType.ExternalInvocationTypeRequest,
): PQP.Language.Type.TTable | PQP.Language.Type.None | undefined {
    const table: PQP.Language.Type.PowerQueryType = PQP.Language.TypeUtils.assertAsTable(
        PQP.Assert.asDefined(request.args[0]),
    );
    const columnName: PQP.Language.Type.TText = PQP.Language.TypeUtils.assertAsText(
        PQP.Assert.asDefined(request.args[1]),
    );
    const columnGenerator: PQP.Language.Type.TFunction = PQP.Language.TypeUtils.assertAsFunction(
        PQP.Assert.asDefined(request.args[2]),
    );
    const maybeColumnType: PQP.Language.Type.PowerQueryType | undefined =
        request.args.length === 4
            ? PQP.Language.TypeUtils.assertAsType(PQP.Assert.asDefined(request.args[3]))
            : undefined;

    // We can't mutate the given table without being able to resolve columnName to a literal.
    if (!PQP.Language.TypeUtils.isTextLiteral(columnName)) {
        return undefined;
    }

    let columnType: PQP.Language.Type.PowerQueryType;
    if (maybeColumnType !== undefined) {
        columnType = maybeColumnType;
    } else if (PQP.Language.TypeUtils.isDefinedFunction(columnGenerator)) {
        columnType = columnGenerator.returnType;
    } else {
        columnType = PQP.Language.Type.AnyInstance;
    }

    const normalizedColumnName: string = PQP.StringUtils.normalizeIdentifier(columnName.literal.slice(1, -1));

    if (PQP.Language.TypeUtils.isDefinedTable(table)) {
        // We can't overwrite an existing key.
        if (table.fields.has(normalizedColumnName)) {
            return PQP.Language.Type.NoneInstance;
        }

        return PQP.Language.TypeUtils.createDefinedTable(
            table.isNullable,
            new Map<string, PQP.Language.Type.PowerQueryType>([
                ...table.fields.entries(),
                [normalizedColumnName, columnType],
            ]),
            table.isOpen,
        );
    } else {
        return PQP.Language.TypeUtils.createDefinedTable(
            table.isNullable,
            new Map<string, PQP.Language.Type.PowerQueryType>([[normalizedColumnName, columnType]]),
            true,
        );
    }
}

interface SpecializedDuo {
    readonly value: PQP.Language.Type.PowerQueryType;
    readonly invocationResolverFn: PQLS.Inspection.ExternalType.TExternalInvocationTypeResolverFn;
}

const TableAddColumnType: PQP.Language.Type.DefinedFunction = PQP.Language.TypeUtils.createDefinedFunction(
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

const SpecializedDuoResolvers: ReadonlyMap<string, SpecializedDuo> = new Map([
    [
        FunctionName.TableAddColumn,
        {
            value: TableAddColumnType,
            invocationResolverFn: resolveTableAddColumn,
        },
    ],
]);
