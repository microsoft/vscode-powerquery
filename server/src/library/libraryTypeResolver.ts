// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Contains smart type resolvers for library functions,
// such as Table.AddColumn(...) returning a DefinedTable.

import * as PQP from "@microsoft/powerquery-parser";
import { ExternalType, Library } from "@microsoft/powerquery-language-services";
import { Type, TypeUtils } from "@microsoft/powerquery-parser/lib/powerquery-parser/language";

// Takes the definitions for a library and returns a type resolver.
export function createExternalTypeResolver(
    staticLibraryDefinitions: Library.ILibrary,
    dynamicLibraryDefinitions: ReadonlyArray<() => ReadonlyMap<string, Library.TLibraryDefinition>>,
): ExternalType.TExternalTypeResolverFn {
    return (request: ExternalType.TExternalTypeRequest): PQP.Language.Type.TPowerQueryType | undefined => {
        const staticLibraryType: PQP.Language.Type.TPowerQueryType | undefined =
            staticLibraryDefinitions.externalTypeResolver(request);

        // We might have defined a smart type resolver for a built-in library function.
        if (staticLibraryType) {
            switch (request.kind) {
                case ExternalType.ExternalTypeRequestKind.Invocation: {
                    const key: string = TypeUtils.nameOf(
                        staticLibraryType,
                        PQP.Trace.NoOpTraceManagerInstance,
                        undefined,
                    );

                    const maybeSmartTypeResolverFn: SmartTypeResolverFn | undefined = SmartTypeResolverFns.get(key);

                    if (maybeSmartTypeResolverFn === undefined) {
                        return undefined;
                    }

                    const typeChecked: TypeUtils.CheckedInvocation = TypeUtils.typeCheckInvocation(
                        request.args,
                        // If it's an invocation type then it's assumed we
                        // already confirmed the request is about a DefinedFunction.
                        TypeUtils.assertAsDefinedFunction(staticLibraryType),
                        PQP.Trace.NoOpTraceManagerInstance,
                        undefined,
                    );

                    if (!isValidInvocation(typeChecked)) {
                        return undefined;
                    }

                    return maybeSmartTypeResolverFn(request.args);
                }

                case ExternalType.ExternalTypeRequestKind.Value:
                    return staticLibraryType;

                default:
                    return undefined;
            }
        }

        // Else look in the dynamic library definitions for a type.
        for (const getter of dynamicLibraryDefinitions) {
            const dynamicLibraryType: PQP.Language.Type.TPowerQueryType | undefined = getter().get(
                request.identifierLiteral,
            )?.asPowerQueryType;

            if (dynamicLibraryType) {
                return dynamicLibraryType;
            }
        }

        return undefined;
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

    const normalizedColumnName: string = PQP.Language.TextUtils.normalizeIdentifier(columnName.literal.slice(1, -1));

    if (TypeUtils.isDefinedTable(table)) {
        // We can't overwrite an existing key.
        if (table.fields.has(normalizedColumnName)) {
            return Type.NoneInstance;
        }

        return TypeUtils.definedTable(
            table.isNullable,
            new PQP.OrderedMap([...table.fields.entries(), [normalizedColumnName, columnType]]),
            table.isOpen,
        );
    } else {
        return TypeUtils.definedTable(table.isNullable, new PQP.OrderedMap([[normalizedColumnName, columnType]]), true);
    }
}

// We don't have a way to know when the library has a behavioral change.
// The best we can do is check if a type signature changed by using TypeUtils.nameOf(invoked function).
const SmartTypeResolverFns: ReadonlyMap<string, SmartTypeResolverFn> = new Map([
    [
        "(table: table, newColumnName: text, columnGenerator: function, columnType: optional nullable type) => table",
        resolveTableAddColumn,
    ],
]);
