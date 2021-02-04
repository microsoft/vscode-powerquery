// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { CompletionItemKind, MarkupKind } from "vscode-languageserver-types";
import type {
    CompletionItem,
    Hover,
    MarkupContent,
    ParameterInformation,
    Range,
    SignatureInformation,
} from "vscode-languageserver-types";

import * as PQLS from "@microsoft/powerquery-language-services";

export function cloneCompletionItemsWithRange(completionItems: CompletionItem[], range: Range): CompletionItem[] {
    const result: CompletionItem[] = [];
    completionItems.forEach(item => {
        result.push({
            ...item,
            textEdit: {
                range,
                newText: item.label,
            },
        });
    });

    return result;
}

export function libraryDefinitionToCompletionItem(definition: PQLS.Library.TLibraryDefinition): CompletionItem {
    return {
        label: definition.label,
        kind: exportKindToCompletionItemKind(definition.kind),
        documentation: definition.description,
    };
}

export function libraryDefinitionToHover(definition: PQLS.Library.TLibraryDefinition, range?: Range): Hover {
    let contents: MarkupContent;

    // TODO: move this into LibraryDefinition - we should be able to call ".getMarkdownFormattedString()"
    if (PQLS.Library.isFunction(definition) || PQLS.Library.isConstructor(definition)) {
        contents = formatConstructorOrFunctionDefinition(definition);
    } else if (PQLS.Library.isType(definition)) {
        contents = formatTypeDefinition(definition);
    } else {
        contents = formatConstantDefinition(definition);
    }

    return {
        contents,
        range,
    };
}

export function signatureInformation(libraryFunction: PQLS.Library.LibraryFunction): SignatureInformation[] {
    return libraryFunction.signatures.map(signature => {
        return {
            label: signature.label,
            documentation: libraryFunction.label ?? "",
            parameters: parametersToParameterInformation(signature.parameters),
        };
    });
}

function exportKindToCompletionItemKind(kind: PQLS.Library.LibraryDefinitionKind): CompletionItemKind {
    switch (kind) {
        case PQLS.Library.LibraryDefinitionKind.Constant:
            return CompletionItemKind.Constant;
        case PQLS.Library.LibraryDefinitionKind.Constructor:
            return CompletionItemKind.Constructor;
        case PQLS.Library.LibraryDefinitionKind.Function:
            return CompletionItemKind.Function;
        case PQLS.Library.LibraryDefinitionKind.Type:
            return CompletionItemKind.TypeParameter;
        default:
            throw new Error(`Unmapped ExportKind: ${kind}`);
    }
}

function parametersToParameterInformation(
    parameters: ReadonlyArray<PQLS.Library.LibraryParameter>,
): ParameterInformation[] {
    return parameters.map(parameter => {
        return {
            label: [parameter.signatureLabelOffset, parameter.signatureLabelEnd],
            documentation: parameter.maybeDocumentation ?? parameter.typeKind,
        };
    });
}

function formatTypeDefinition(definition: PQLS.Library.LibraryType): MarkupContent {
    return {
        kind: MarkupKind.Markdown,
        value: `(type) ${definition.label}\n\n\n${definition.description}`,
    };
}

function formatConstantDefinition(definition: PQLS.Library.LibraryConstant): MarkupContent {
    return {
        kind: MarkupKind.Markdown,
        value: `(constant) ${definition.label}\n\n\n${definition.description}`,
    };
}

function formatConstructorOrFunctionDefinition(
    definition: PQLS.Library.LibraryConstructor | PQLS.Library.LibraryFunction,
): MarkupContent {
    // TODO: assert that we have at least one signature
    return {
        kind: MarkupKind.Markdown,
        value: [
            "```powerquery",
            definition.signatures[definition.signatures.length - 1].label,
            "```",
            definition.description,
        ].join("\n"),
    };
}
