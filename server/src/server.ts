/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as PowerQueryParser from "@microsoft/powerquery-parser";
import {
    format,
    FormatError,
    FormatRequest,
    IndentationLiteral,
    NewlineLiteral,
    Result,
    ResultKind,
    SerializerOptions,
} from "powerquery-format";
import { AllModules, Library, LibraryDefinition } from "powerquery-library";
import * as LS from "vscode-languageserver";
import { LanguageServiceHelpers } from "./languageServiceHelpers";
import { DocumentSymbol } from "./symbol";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: LS.TextDocuments = new LS.TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
// TODO jobolton: this is unused?
// let hasDiagnosticRelatedInformationCapability: boolean = false;

let pqLibrary: Library;
let defaultCompletionItems: LS.CompletionItem[];

connection.onInitialize((params: LS.InitializeParams) => {
    const capabilities: LS.ClientCapabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    // TODO jobolton: this is unused?
    // hasDiagnosticRelatedInformationCapability = !!(
    //     capabilities.textDocument &&
    //     capabilities.textDocument.publishDiagnostics &&
    //     capabilities.textDocument.publishDiagnostics.relatedInformation
    // );

    initializeLibrary();

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            documentFormattingProvider: true,
            completionProvider: {
                // TODO: is it better to return the first pass without documention to reduce message size?
                resolveProvider: false,
            },
            hoverProvider: true,
            // signatureHelpProvider: {
            // 	triggerCharacters: ['(', ',']
            // }
        },
    };
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(LS.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log("Workspace folder change event received.");
        });
    }
});

function initializeLibrary(): void {
    pqLibrary = AllModules;
    defaultCompletionItems = [];

    for (const definition of pqLibrary.values()) {
        const completionItem: LS.CompletionItem = LanguageServiceHelpers.LibraryDefinitionToCompletionItem(definition);
        defaultCompletionItems.push(completionItem);
    }
}

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
        globalSettings = (change.settings.powerquery || defaultSettings) as PowerQuerySettings;
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
            section: "powerquery",
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
    // TODO: lex/parse document and store result.
    validateDocument(change.document);
});

function lexerErrorToDiagnostics(error: PowerQueryParser.LexerError.TInnerLexerError): LS.Diagnostic[] | null {
    let diagnostics: LS.Diagnostic[] = null;

    // TODO: handle other types of lexer errors
    if (error instanceof PowerQueryParser.LexerError.ErrorLineMapError) {
        diagnostics = [];
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PowerQueryParser.LexerError.TInnerLexerError = errorLine.error.innerError;
            if ((innerError as any).graphemePosition) {
                const graphemePosition: PowerQueryParser.StringHelpers.GraphemePosition = (innerError as any)
                    .graphemePosition;
                const message: string = innerError.message;
                const position: LS.Position = {
                    line: graphemePosition.lineNumber,
                    character: graphemePosition.columnNumber,
                };

                // TODO: "lex" errors aren't that useful to display to end user. Should we make it more generic?
                diagnostics.push({
                    message: message,
                    severity: LS.DiagnosticSeverity.Error,
                    range: {
                        start: position,
                        end: position,
                    },
                });
            }
        }
    }

    return diagnostics;
}

function parserErrorToDiagnostic(error: PowerQueryParser.ParserError.TInnerParserError): LS.Diagnostic | null {
    let message = error.message;
    let errorToken: PowerQueryParser.Token = null;

    if (
        error instanceof PowerQueryParser.ParserError.ExpectedAnyTokenKindError ||
        error instanceof PowerQueryParser.ParserError.ExpectedTokenKindError
    ) {
        errorToken = error.maybeFoundToken.token;
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
                    character: errorToken.positionStart.columnNumber,
                },
                end: {
                    line: errorToken.positionEnd.lineNumber,
                    character: errorToken.positionEnd.columnNumber,
                },
            },
        };
    }

    return null;
}

async function validateDocument(textDocument: LS.TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    //let settings = await getDocumentSettings(textDocument.uri);

    // TODO: our document store needs to nornalize line terminators.
    // TODO: parser result should be calculated as result of changed and stored in TextDocument.
    const text: string = textDocument.getText();
    let diagnostics: LS.Diagnostic[] = [];

    // TODO: switch to new parser interface that is line terminator agnostic.
    const triedLexAndParse: PowerQueryParser.TriedLexAndParse = PowerQueryParser.tryLexAndParse(text);
    if (triedLexAndParse.kind !== PowerQueryParser.ResultKind.Ok) {
        const error = triedLexAndParse.error;
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
    connection.console.log("We received an file change event");
});

// TODO: Update formatter to use @microsoft/powerquery-parser
connection.onDocumentFormatting((_documentfomattingParams: LS.DocumentFormattingParams): LS.TextEdit[] => {
    const document: LS.TextDocument = documents.get(_documentfomattingParams.textDocument.uri);
    const options: LS.FormattingOptions = _documentfomattingParams.options;
    let textEditResult: LS.TextEdit[] = [];

    let indentationLiteral: IndentationLiteral;
    if (options.insertSpaces) {
        indentationLiteral = IndentationLiteral.SpaceX4;
    } else {
        indentationLiteral = IndentationLiteral.Tab;
    }

    // TODO: get the newline terminator for the document/workspace
    const serializerOptions: SerializerOptions = {
        indentationLiteral,
        newlineLiteral: NewlineLiteral.Windows,
    };

    const formatRequest: FormatRequest = {
        text: document.getText(),
        options: serializerOptions,
    };

    const formatResult: Result<string, FormatError.TFormatError> = format(formatRequest);
    if (formatResult.kind === ResultKind.Ok) {
        textEditResult.push(LS.TextEdit.replace(fullDocumentRange(document), formatResult.value));
    } else {
        // TODO: should this go in the failed promise path?
        const error = formatResult.error;
        let message: string;
        if (FormatError.isTFormatError(error)) {
            message = error.innerError.message;
        } else {
            message = "An unknown error occured during formatting.";
        }

        connection.window.showErrorMessage(message);
    }

    return textEditResult;
});

// TODO: is there a better way to do this?
function fullDocumentRange(document: LS.TextDocument): LS.Range {
    return {
        start: document.positionAt(0),
        end: {
            line: document.lineCount - 1,
            character: Number.MAX_VALUE,
        },
    };
}

function getSymbolDefinitionAt(_textDocumentPosition: LS.TextDocumentPositionParams): DocumentSymbol | null {
    const token: PowerQueryParser.LineToken = getTokenAt(_textDocumentPosition);
    if (token) {
        let definition: LibraryDefinition = null;
        if (token.kind === PowerQueryParser.LineTokenKind.Identifier) {
            let tokenText: string = token.data;
            definition = pqLibrary[tokenText];
        }

        return new DocumentSymbol(token, definition);
    }

    return null;
}

function getLineTokensAt(_textDocumentPosition: LS.TextDocumentPositionParams): readonly PowerQueryParser.LineToken[] {
    const document: LS.TextDocument = documents.get(_textDocumentPosition.textDocument.uri);
    const position: LS.Position = _textDocumentPosition.position;

    // Get symbol at current position
    // TODO: parsing result should be cached
    // TODO: switch to new parser interface that is line terminator agnostic.
    const lexResult = PowerQueryParser.Lexer.stateFrom(document.getText());
    const line = lexResult.lines[position.line];

    if (line) {
        return line.tokens;
    }

    return null;
}

function getTokenAt(_textDocumentPosition: LS.TextDocumentPositionParams): PowerQueryParser.LineToken {
    const lineTokens = getLineTokensAt(_textDocumentPosition);
    if (lineTokens) {
        const position: LS.Position = _textDocumentPosition.position;
        for (let i: number = 0; i < lineTokens.length; i++) {
            let currentToken = lineTokens[i];
            if (currentToken.positionStart <= position.character && currentToken.positionEnd >= position.character) {
                return currentToken;
            }
        }
    }

    return null;
}

// TODO: make completion requests context sensitive
connection.onCompletion((_textDocumentPosition: LS.TextDocumentPositionParams): LS.CompletionItem[] => {
    return defaultCompletionItems;
});

connection.onHover(
    (_textDocumentPosition: LS.TextDocumentPositionParams): LS.Hover => {
        let result: LS.Hover = null;
        const documentSymbol: DocumentSymbol = getSymbolDefinitionAt(_textDocumentPosition);
        if (documentSymbol.definition) {
            const position: LS.Position = _textDocumentPosition.position;
            const hover: LS.Hover = LanguageServiceHelpers.LibraryDefinitionToHover(documentSymbol.definition);
            // fill in the range information
            hover.range = {
                start: {
                    line: position.line,
                    character: documentSymbol.token.positionStart,
                },
                end: {
                    line: position.line,
                    character: documentSymbol.token.positionEnd,
                },
            };
            result = hover;
        }

        return result;
    },
);

// connection.onSignatureHelp(
// 	(_textDocumentPosition: TextDocumentPositionParams): SignatureHelp => {
// 		let result: SignatureHelp = null;
// 		const symbol: DocumentSymbol = getSymbolDefinitionAt(_textDocumentPosition);
// 		if (symbol.definition && LanguageServiceHelpers.IsFunction(symbol.definition)) {
// 			const signatures = LanguageServiceHelpers.SignaturesToSignatureInformation(symbol.definition.signatures);

// 			// TODO: calculate the correct activeSignature and activeParameter
// 			result = {
// 				signatures: signatures,
// 				activeSignature: signatures.length,	// use the last signature
// 				activeParameter: null
// 			}
// 		}

// 		return result;
// 	}
// );

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
