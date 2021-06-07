// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Contains smart type resolvers for standard library functions,
// such as Table.AddColumn(...) returning a DefinedTable.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";

// Takes the definitions for a standard library and returns a type resolver.
export function createStandardLibraryTypeResolver(
    libraryDefinitions: PQLS.Library.LibraryDefinitions,
): PQLS.Inspection.ExternalType.TExternalTypeResolverFn {
    return (request: PQLS.Inspection.ExternalType.TExternalTypeRequest) => {
        const maybeLibraryType: PQP.Language.Type.TPowerQueryType | undefined = libraryDefinitions.get(
            request.identifierLiteral,
        )?.asPowerQueryType;

        if (maybeLibraryType === undefined) {
            return undefined;
        }
        // It's asking for a value, which we already have.
        else if (request.kind === PQLS.Inspection.ExternalType.ExternalTypeRequestKind.Value) {
            return maybeLibraryType;
        } else {
            const key: string = PQP.Language.TypeUtils.nameOf(maybeLibraryType);
            const maybeSmartTypeResolverFn: SmartTypeResolverFn | undefined = SmartTypeResolverFns.get(key);

            if (maybeSmartTypeResolverFn === undefined) {
                return undefined;
            }

            const typeChecked: PQP.Language.TypeUtils.CheckedInvocation = PQP.Language.TypeUtils.typeCheckInvocation(
                request.args,
                // If it's an invocation type then it's assumed we
                // already confirmed the request is about a DefinedFunction.
                PQP.Language.TypeUtils.assertAsDefinedFunction(maybeLibraryType),
            );

            if (isValidInvocation(typeChecked)) {
                return undefined;
            }

            return maybeSmartTypeResolverFn(request.args);
        }
    };
}

type SmartTypeResolverFn = (
    args: ReadonlyArray<PQP.Language.Type.TPowerQueryType>,
) => PQP.Language.Type.TPowerQueryType | undefined;

function isValidInvocation(typeChecked: PQP.Language.TypeUtils.CheckedInvocation): boolean {
    return !typeChecked.extraneous.length && !typeChecked.invalid.size && !typeChecked.missing.length;
}

function resolveTableAddColumn(
    args: ReadonlyArray<PQP.Language.Type.TPowerQueryType>,
): PQP.Language.Type.TPowerQueryType | undefined {
    const table: PQP.Language.Type.TPowerQueryType = PQP.Language.TypeUtils.assertAsTable(
        PQP.Assert.asDefined(args[0]),
    );
    const columnName: PQP.Language.Type.TText = PQP.Language.TypeUtils.assertAsText(PQP.Assert.asDefined(args[1]));
    const columnGenerator: PQP.Language.Type.TFunction = PQP.Language.TypeUtils.assertAsFunction(
        PQP.Assert.asDefined(args[2]),
    );
    const maybeColumnType: PQP.Language.Type.TPowerQueryType | undefined =
        args.length === 4 ? PQP.Language.TypeUtils.assertAsType(PQP.Assert.asDefined(args[3])) : undefined;

    // We can't mutate the given table without being able to resolve columnName to a literal.
    if (!PQP.Language.TypeUtils.isTextLiteral(columnName)) {
        return undefined;
    }

    let columnType: PQP.Language.Type.TPowerQueryType;
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
            new Map<string, PQP.Language.Type.TPowerQueryType>([
                ...table.fields.entries(),
                [normalizedColumnName, columnType],
            ]),
            table.isOpen,
        );
    } else {
        return PQP.Language.TypeUtils.createDefinedTable(
            table.isNullable,
            new Map<string, PQP.Language.Type.TPowerQueryType>([[normalizedColumnName, columnType]]),
            true,
        );
    }
}

// We don't have a way to know when the standard library has a behavioral change.
// The best we can do is check if a type signature changed by using TypeUtils.nameOf(invoked function).
const SmartTypeResolverFns: ReadonlyMap<string, SmartTypeResolverFn> = new Map([
    [
        "(table: table, newColumnName: text, columnGenerator: function, columnType: optional nullable type) => table",
        resolveTableAddColumn,
    ],
]);
