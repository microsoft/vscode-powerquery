import { LibraryDefinition } from 'powerquery-library';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { ExportKind } from 'powerquery-library/lib/library/jsonTypes';

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export class LanguageServiceHelpers {
	public static LibraryDefinitionToCompletionItem(definition: LibraryDefinition): CompletionItem {
		return {
			label: definition.label,
			kind: LanguageServiceHelpers.ExportKindToCompletionItemKind(definition.kind),
			documentation: definition.summary
		};
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
}