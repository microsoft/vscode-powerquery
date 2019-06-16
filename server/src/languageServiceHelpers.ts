import { ExportKind, LibraryDefinition, Parameter, Signature } from "powerquery-library";
import {
    CompletionItem,
    CompletionItemKind,
    Hover,
    MarkupContent,
    MarkupKind,
    ParameterInformation,
    SignatureInformation,
} from "vscode-languageserver";

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export class LanguageServiceHelpers {
    public static LibraryDefinitionToCompletionItem(definition: LibraryDefinition): CompletionItem {
        return {
            label: definition.label,
            kind: LanguageServiceHelpers.ExportKindToCompletionItemKind(definition.kind),
            documentation: definition.summary,
        };
    }

    public static LibraryDefinitionToHover(definition: LibraryDefinition): Hover {
        let contents: MarkupContent = null;

        // TODO: move this into LibraryDefinition - we should be able to call ".getMarkdownFormattedString()"
        if (LanguageServiceHelpers.IsFunction(definition)) {
            contents = LanguageServiceHelpers.FormatFunctionDefinition(definition);
        } else if (definition.kind == ExportKind.Type) {
            contents = LanguageServiceHelpers.FormatTypeDefinition(definition);
        } else {
            contents = LanguageServiceHelpers.FormatConstantDefinition(definition);
        }

        return {
            contents: contents,
        };
    }

    public static IsFunction(definition: LibraryDefinition) {
        return definition && (definition.kind === ExportKind.Function || definition.kind === ExportKind.Constructor);
    }

    public static ExportKindToCompletionItemKind(kind: ExportKind): CompletionItemKind {
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
                throw "Unmapped ExportKind: " + ExportKind;
        }
    }

    public static SignaturesToSignatureInformation(signatures: Signature[]): SignatureInformation[] {
        const result: SignatureInformation[] = [];
        signatures.forEach(s => {
            result.push({
                label: s.label,
                documentation: s.documentation,
                parameters: LanguageServiceHelpers.ParametersToParameterInformation(s.parameters),
            });
        });

        return result;
    }

    public static ParametersToParameterInformation(parameters: Parameter[]): ParameterInformation[] {
        const result: ParameterInformation[] = [];
        parameters.forEach(p => {
            result.push({
                // use the range from the signature
                label: [p.labelOffsetStart, p.labelOffsetEnd],
                documentation: p.documentation,
            });
        });

        return result;
    }

    private static FormatTypeDefinition(definition: LibraryDefinition): MarkupContent {
        return {
            kind: MarkupKind.Markdown,
            value: ["(type) " + definition.label, "\n", definition.summary].join("\n"),
        };
    }

    private static FormatConstantDefinition(definition: LibraryDefinition): MarkupContent {
        return {
            kind: MarkupKind.Markdown,
            value: ["(constant) " + definition.label, "\n", definition.summary].join("\n"),
        };
    }

    private static FormatFunctionDefinition(definition: LibraryDefinition): MarkupContent {
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
}
