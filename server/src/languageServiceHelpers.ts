// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LibraryDefinition, LibraryDefinitionKind, Parameter, Signature } from "powerquery-library";
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
    let contents: MarkupContent;

    // TODO: move this into LibraryDefinition - we should be able to call ".getMarkdownFormattedString()"
    if (isFunction(definition)) {
        contents = formatFunctionDefinition(definition);
    } else if (definition.kind === LibraryDefinitionKind.Type) {
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
    return (
        definition &&
        (definition.kind === LibraryDefinitionKind.Function || definition.kind === LibraryDefinitionKind.Constructor)
    );
}

export function exportKindToCompletionItemKind(kind: LibraryDefinitionKind): CompletionItemKind {
    switch (kind) {
        case LibraryDefinitionKind.Constant:
            return CompletionItemKind.Constant;
        case LibraryDefinitionKind.Constructor:
            return CompletionItemKind.Constructor;
        case LibraryDefinitionKind.Function:
            return CompletionItemKind.Function;
        case LibraryDefinitionKind.Type:
            // Currently the best match for type
            return CompletionItemKind.Struct;
        default:
            throw new Error(`Unmapped ExportKind: ${kind}`);
    }
}

export function signaturesToSignatureInformation(signatures: ReadonlyArray<Signature>): SignatureInformation[] {
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
