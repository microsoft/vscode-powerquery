import { ExportKind, LibraryDefinition, Parameter, Signature } from "powerquery-library";
import {
    CompletionItem,
    CompletionItemKind,
    Hover,
    MarkupContent,
    MarkupKind,
    ParameterInformation,
    Range,
    SignatureInformation,
} from "vscode-languageserver";

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export function libraryDefinitionToCompletionItem(definition: LibraryDefinition): CompletionItem {
    return {
        label: definition.label,
        kind: exportKindToCompletionItemKind(definition.kind),
        documentation: definition.summary,
    };
}

export function libraryDefinitionToHover(definition: LibraryDefinition, range: Range): Hover {
    let contents: undefined | MarkupContent = undefined;

    // TODO: move this into LibraryDefinition - we should be able to call ".getMarkdownFormattedString()"
    if (isFunction(definition)) {
        contents = formatFunctionDefinition(definition);
    } else if (definition.kind === ExportKind.Type) {
        contents = formatTypeDefinition(definition);
    } else {
        contents = formatConstantDefinition(definition);
    }

    return {
        contents,
        range,
    };
}

export function isFunction(definition: LibraryDefinition): boolean {
    return definition && (definition.kind === ExportKind.Function || definition.kind === ExportKind.Constructor);
}

export function exportKindToCompletionItemKind(kind: ExportKind): CompletionItemKind {
    switch (kind) {
        case ExportKind.Constant:
            return CompletionItemKind.Constant;
        case ExportKind.Constructor:
            return CompletionItemKind.Constructor;
        case ExportKind.Function:
            return CompletionItemKind.Function;
        case ExportKind.Type:
            // Currently the best match for type
            return CompletionItemKind.Struct;
        default:
            throw new Error(`Unmapped ExportKind: ${kind}`);
    }
}

export function signaturesToSignatureInformation(signatures: Signature[]): SignatureInformation[] {
    return signatures.map(signature => {
        return {
            label: signature.label,
            documentation: signature.documentation,
            parameters: parametersToParameterInformation(signature.parameters),
        };
    });
}

export function parametersToParameterInformation(parameters: ReadonlyArray<Parameter>): ParameterInformation[] {
    return parameters.map(parameter => {
        return {
            label: [parameter.labelOffsetStart, parameter.labelOffsetEnd],
            documentation: parameter.documentation,
        };
    });
}

function formatTypeDefinition(definition: LibraryDefinition): MarkupContent {
    return {
        kind: MarkupKind.Markdown,
        value: `(type) ${definition.label}\n\n\n${definition.summary}`,
    };
}

function formatConstantDefinition(definition: LibraryDefinition): MarkupContent {
    return {
        kind: MarkupKind.Markdown,
        value: `(constant) ${definition.label}\n\n\n${definition.summary}`,
    };
}

function formatFunctionDefinition(definition: LibraryDefinition): MarkupContent {
    return {
        kind: MarkupKind.Markdown,
        value: [
            "```powerquery",
            definition.signatures[definition.signatures.length - 1].label,
            "```",
            definition.summary,
        ].join("\n"),
    };
}
