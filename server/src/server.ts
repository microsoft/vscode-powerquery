/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	DocumentFormattingParams,
	TextEdit,
	FormattingOptions,
	Range,
	Position
} from 'vscode-languageserver';

import {
	format,
	FormatError,
	FormatRequest,
	IndentationLiteral,
	NewlineLiteral,
	Result,
	ResultKind,
	SerializerOptions
} from "powerquery-format";

import * as PowerQueryParser from "@microsoft/powerquery-parser";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			documentFormattingProvider: true,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true
			}
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface PowerQuerySettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: PowerQuerySettings = { maxNumberOfProblems: 1000 };
let globalSettings: PowerQuerySettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<PowerQuerySettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <PowerQuerySettings>(
			(change.settings.powerquery || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateDocument);
});

function getDocumentSettings(resource: string): Thenable<PowerQuerySettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'powerquery'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
	validateDocument(change.document);
});

function lexerErrorToDiagnostics(error: PowerQueryParser.LexerError.TInnerLexerError): Diagnostic[] | null {
	let diagnostics: Diagnostic[] = null;

	// TODO: handle other types of lexer errors
	if (error instanceof PowerQueryParser.LexerError.ErrorLineError) {
		diagnostics = [];
		for (let lineNumber of Object.keys(error.errors)) {
			const errorLine = error.errors[Number.parseInt(lineNumber)];
			const innerError = errorLine.error.innerError;
			if ((<any>innerError).graphemePosition) {
				const graphemePosition: PowerQueryParser.StringHelpers.GraphemePosition = (<any>innerError).graphemePosition;
				const message = innerError.message;
				const position: Position = {
					line: graphemePosition.lineNumber,
					character: graphemePosition.columnNumber
				};

				// TODO: "lex" errors aren't that useful to display to end user. Should we make it more generic?
				diagnostics.push({
					message: message,
					severity: DiagnosticSeverity.Error,
					range: {
						start: position,
						end: position
					}
				});
			}
		}
	}

	return diagnostics;
}

function parserErrorToDiagnostic(error: PowerQueryParser.ParserError.TInnerParserError): Diagnostic | null {
	let message = error.message;
	let errorToken: PowerQueryParser.Token = null;

	if (error instanceof PowerQueryParser.ParserError.ExpectedAnyTokenKindError ||
		error instanceof PowerQueryParser.ParserError.ExpectedTokenKindError) {
		errorToken = error.maybeFoundToken;
	} else if (error instanceof PowerQueryParser.ParserError.InvalidPrimitiveTypeError) {
		errorToken = error.token;
	} else if (error instanceof PowerQueryParser.ParserError.UnterminatedBracketError) {
		errorToken = error.openBracketToken;
	} else if (error instanceof PowerQueryParser.ParserError.UnterminatedParenthesesError) {
		errorToken = error.openParenthesesToken;
	} else if (error instanceof PowerQueryParser.ParserError.UnusedTokensRemainError) {
		errorToken = error.firstUnusedToken;
	}

	if (errorToken !== null) {
		return {
			message: message,
			severity: DiagnosticSeverity.Error,
			range: {
				start: {
					line: errorToken.positionStart.lineNumber,
					character: errorToken.positionStart.columnNumber
				},
				end: {
					line: errorToken.positionEnd.lineNumber,
					character: errorToken.positionEnd.columnNumber
				}
			}
		};
	}

	return null;
}

async function validateDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	//let settings = await getDocumentSettings(textDocument.uri);

	const text: string = textDocument.getText();
	let diagnostics: Diagnostic[] = [];

	// TODO: how do we retrieve the line terminator for the workspace/current document?
	const parseResult = PowerQueryParser.lexAndParse(text, "\r\n");
	if (parseResult.kind !== PowerQueryParser.ResultKind.Ok) {
		const error = parseResult.error;
		const innerError = error.innerError;

		if (PowerQueryParser.ParserError.isTInnerParserError(innerError)) {
			let diagnostic = parserErrorToDiagnostic(innerError);
			if (diagnostic) {
				diagnostics.push(diagnostic);
			}
		} else if (PowerQueryParser.LexerError.isTInnerLexerError(innerError)) {
			let lexerErrorDiagnostics = lexerErrorToDiagnostics(innerError);
			if (lexerErrorDiagnostics != null) {
				diagnostics = lexerErrorDiagnostics;
			}
		}
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onDocumentFormatting(
	(_documentfomattingParams: DocumentFormattingParams): TextEdit[] => {
		const document: TextDocument = documents.get(_documentfomattingParams.textDocument.uri);
		const options: FormattingOptions = _documentfomattingParams.options;
		let textEditResult: TextEdit[] = [];

		let indentationLiteral: IndentationLiteral;
		if (options.insertSpaces) {
			indentationLiteral = IndentationLiteral.SpaceX4;
		}
		else {
			indentationLiteral = IndentationLiteral.Tab;
		}

		// TODO: get the newline terminator for the document/workspace
		const serializerOptions: SerializerOptions = {
			indentationLiteral,
			newlineLiteral: NewlineLiteral.Windows
		};

		const formatRequest: FormatRequest = {
			document: document.getText(),
			options: serializerOptions
		};

		const formatResult: Result<string, FormatError.TFormatError> = format(formatRequest);
		if (formatResult.kind === ResultKind.Ok) {
			textEditResult.push(
				TextEdit.replace(fullDocumentRange(document), formatResult.value)
			);
		} else {
			// TODO: should this go in the failed promise path?
			const error = formatResult.error;
			let message: string;
			if (FormatError.isTFormatError(error)) {
				message = error.innerError.message;
			}
			else {
				message = "An unknown error occured during formatting.";
			}

			connection.window.showErrorMessage(message);
		}

		return textEditResult
	}
);

// TODO: is there a better way to do this?
function fullDocumentRange(document: TextDocument): Range {
	return {
		start: document.positionAt(0),
		end: {
			line: document.lineCount - 1,
			character: Number.MAX_VALUE
		}
	};
}

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
