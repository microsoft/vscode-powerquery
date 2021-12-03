// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Contains smart type resolvers for standard library functions,
// such as Table.AddColumn(...) returning a DefinedTable.

import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
// tslint:disable-next-line: no-submodule-imports
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

// Takes the definitions for a standard library and returns a type resolver.
export function createStandardLibraryTypeResolver(
    libraryDefinitions: PQLS.Library.LibraryDefinitions,
): PQLS.Inspection.ExternalType.TExternalTypeResolverFn {
    return (request: PQLS.Inspection.ExternalType.TExternalTypeRequest) => {
        const maybeLibraryType: Type.TPowerQueryType | undefined = libraryDefinitions.get(
            request.identifierLiteral,
        )?.asPowerQueryType;

        if (maybeLibraryType === undefined) {
            return undefined;
        }
        // It's asking for a value, which we already have.
        else if (request.kind === PQLS.Inspection.ExternalType.ExternalTypeRequestKind.Value) {
            return maybeLibraryType;
        } else {
            const key: string = TypeUtils.nameOf(maybeLibraryType);
            const maybeSmartTypeResolverFn: SmartTypeResolverFn | undefined = SmartTypeResolverFns.get(key);

            if (maybeSmartTypeResolverFn === undefined) {
                return undefined;
            }

            const typeChecked: TypeUtils.CheckedInvocation = TypeUtils.typeCheckInvocation(
                request.args,
                // If it's an invocation type then it's assumed we
                // already confirmed the request is about a DefinedFunction.
                TypeUtils.assertAsDefinedFunction(maybeLibraryType),
            );

            if (!isValidInvocation(typeChecked)) {
                return undefined;
            }

            return maybeSmartTypeResolverFn(request.args);
        }
    };
}

type SmartTypeResolverFn = (args: ReadonlyArray<Type.TPowerQueryType>) => Type.TPowerQueryType | undefined;

function isValidInvocation(typeChecked: TypeUtils.CheckedInvocation): boolean {
    return !typeChecked.extraneous.length && !typeChecked.invalid.size && !typeChecked.missing.length;
}

function resolveTableAddColumn(args: ReadonlyArray<Type.TPowerQueryType>): Type.TPowerQueryType | undefined {
    const table: Type.TPowerQueryType = TypeUtils.assertAsTable(PQP.Assert.asDefined(args[0]));
    const columnName: Type.TText = TypeUtils.assertAsText(PQP.Assert.asDefined(args[1]));
    const columnGenerator: Type.TFunction = TypeUtils.assertAsFunction(PQP.Assert.asDefined(args[2]));
    const maybeColumnType: Type.TPowerQueryType | undefined =
        args.length === 4 ? TypeUtils.assertAsType(PQP.Assert.asDefined(args[3])) : undefined;

    // We can't mutate the given table without being able to resolve columnName to a literal.
    if (!TypeUtils.isTextLiteral(columnName)) {
        return undefined;
    }

    let columnType: Type.TPowerQueryType;
    if (maybeColumnType !== undefined) {
        columnType = maybeColumnType;
    } else if (TypeUtils.isDefinedFunction(columnGenerator)) {
        columnType = columnGenerator.returnType;
    } else {
        columnType = Type.AnyInstance;
    }

    const normalizedColumnName: string = PQP.StringUtils.normalizeIdentifier(columnName.literal.slice(1, -1));

    if (TypeUtils.isDefinedTable(table)) {
        // We can't overwrite an existing key.
        if (table.fields.has(normalizedColumnName)) {
            return Type.NoneInstance;
        }

        return TypeUtils.createDefinedTable(
            table.isNullable,
            new PQP.OrderedMap([...table.fields.entries(), [normalizedColumnName, columnType]]),
            table.isOpen,
        );
    } else {
        return TypeUtils.createDefinedTable(
            table.isNullable,
            new PQP.OrderedMap([[normalizedColumnName, columnType]]),
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
