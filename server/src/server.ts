// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as LS from "vscode-languageserver";
import {
    format,
    FormatError,
    FormatRequest,
    IndentationLiteral,
    NewlineLiteral,
    Result,
    ResultKind,
    SerializerOptions,
} from "../../packages/format";
import { AllModules, Library, LibraryDefinition } from "../../packages/library";
import * as LanguageServiceHelpers from "./languageServiceHelpers";
import { DocumentSymbol } from "./symbol";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: LS.Connection = LS.createConnection(LS.ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: LS.TextDocuments = new LS.TextDocuments();

let pqLibrary: Library;
let defaultCompletionItems: LS.CompletionItem[];

connection.onInitialize(() => {
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            documentFormattingProvider: true,
            completionProvider: {
                // TODO: is it better to return the first pass without documention to reduce message size?
                resolveProvider: false,
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ["(", ","],
            },
        },
    };
});

connection.onInitialized(() => {
    initializeLibrary();
});

function initializeLibrary(): void {
    pqLibrary = AllModules;
    defaultCompletionItems = [];

    for (const definition of pqLibrary.values()) {
        const completionItem: LS.CompletionItem = LanguageServiceHelpers.libraryDefinitionToCompletionItem(definition);
        defaultCompletionItems.push(completionItem);
    }
}

// TODO: We'll want this handler when we have our workspace document manager
// documents.onDidClose(e => {
// });

documents.onDidChangeContent(change => {
    // TODO: lex/parse document and store result.
    validateDocument(change.document).catch(err =>
        connection.console.error(`validateDocument err: ${JSON.stringify(err, undefined, 4)}`),
    );
});

function maybeLexerErrorToDiagnostics(error: PQP.LexerError.TInnerLexerError): undefined | LS.Diagnostic[] {
    const diagnostics: LS.Diagnostic[] = [];

    // TODO: handle other types of lexer errors
    if (error instanceof PQP.LexerError.ErrorLineMapError) {
        for (const errorLine of error.errorLineMap.values()) {
            const innerError: PQP.LexerError.TInnerLexerError = errorLine.error.innerError;
            if ((innerError as any).graphemePosition) {
                const graphemePosition: PQP.StringUtils.GraphemePosition = (innerError as any).graphemePosition;
                const message: string = innerError.message;
                const position: LS.Position = {
                    line: graphemePosition.lineNumber,
                    character: graphemePosition.lineCodeUnit,
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

    return diagnostics.length ? diagnostics : undefined;
}

function maybeParserErrorToDiagnostic(error: PQP.ParserError.TInnerParserError): undefined | LS.Diagnostic {
    const message: string = error.message;
    let errorToken: PQP.Token;

    if (
        (error instanceof PQP.ParserError.ExpectedAnyTokenKindError ||
            error instanceof PQP.ParserError.ExpectedTokenKindError) &&
        error.maybeFoundToken !== undefined
    ) {
        errorToken = error.maybeFoundToken.token;
    } else if (error instanceof PQP.ParserError.InvalidPrimitiveTypeError) {
        errorToken = error.token;
    } else if (error instanceof PQP.ParserError.UnterminatedBracketError) {
        errorToken = error.openBracketToken;
    } else if (error instanceof PQP.ParserError.UnterminatedParenthesesError) {
        errorToken = error.openParenthesesToken;
    } else if (error instanceof PQP.ParserError.UnusedTokensRemainError) {
        errorToken = error.firstUnusedToken;
    } else {
        return undefined;
    }

    return {
        message: message,
        severity: LS.DiagnosticSeverity.Error,
        range: {
            start: {
                line: errorToken.positionStart.lineNumber,
                character: errorToken.positionStart.lineCodeUnit,
            },
            end: {
                line: errorToken.positionEnd.lineNumber,
                character: errorToken.positionEnd.lineCodeUnit,
            },
        },
    };
}

async function validateDocument(textDocument: LS.TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    // let settings = await getDocumentSettings(textDocument.uri);

    // TODO: our document store needs to nornalize line terminators.
    // TODO: parser result should be calculated as result of changed and stored in TextDocument.
    const text: string = textDocument.getText();
    let diagnostics: LS.Diagnostic[] = [];

    // TODO: switch to new parser interface that is line terminator agnostic.
    const triedLexAndParse: PQP.TriedLexAndParse = PQP.tryLexAndParse(text);
    if (triedLexAndParse.kind !== PQP.ResultKind.Ok) {
        const lexAndParseErr: PQP.LexAndParseErr = triedLexAndParse.error;
        const innerError: PQP.LexerError.TInnerLexerError | PQP.ParserError.TInnerParserError =
            lexAndParseErr.innerError;

        if (PQP.ParserError.isTInnerParserError(innerError)) {
            const maybeDiagnostic: undefined | LS.Diagnostic = maybeParserErrorToDiagnostic(innerError);
            if (maybeDiagnostic !== undefined) {
                diagnostics = [maybeDiagnostic];
            }
        } else if (PQP.LexerError.isTInnerLexerError(innerError)) {
            const maybeLexerErrorDiagnostics: undefined | LS.Diagnostic[] = maybeLexerErrorToDiagnostics(innerError);
            if (maybeLexerErrorDiagnostics !== undefined) {
                diagnostics = maybeLexerErrorDiagnostics;
            }
        }
    }

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics,
    });
}

connection.onDocumentFormatting((documentfomattingParams: LS.DocumentFormattingParams): LS.TextEdit[] => {
    const maybeDocument: undefined | LS.TextDocument = documents.get(documentfomattingParams.textDocument.uri);
    if (maybeDocument === undefined) {
        return [];
    }
    const document: LS.TextDocument = maybeDocument;

    const options: LS.FormattingOptions = documentfomattingParams.options;
    const textEditResult: LS.TextEdit[] = [];

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
        const error: FormatError.TFormatError = formatResult.error;
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

function maybeDocumentSymbolDefinitionAt(
    textDocumentPosition: LS.TextDocumentPositionParams,
): undefined | DocumentSymbol {
    const maybeToken: undefined | PQP.LineToken = maybeTokenAt(textDocumentPosition);
    if (maybeToken === undefined) {
        return undefined;
    }
    const token: PQP.LineToken = maybeToken;

    let maybeDefinition: undefined | LibraryDefinition;
    if (token.kind === PQP.LineTokenKind.Identifier) {
        maybeDefinition = pqLibrary.get(token.data);
    }

    return new DocumentSymbol(token, maybeDefinition);
}

function maybeLineTokensAt(
    textDocumentPosition: LS.TextDocumentPositionParams,
): undefined | ReadonlyArray<PQP.LineToken> {
    const maybeDocument: undefined | LS.TextDocument = documents.get(textDocumentPosition.textDocument.uri);
    if (maybeDocument === undefined) {
        return undefined;
    }
    const document: LS.TextDocument = maybeDocument;

    // Get symbol at current position
    // TODO: parsing result should be cached
    const position: LS.Position = textDocumentPosition.position;
    const lexResult: PQP.Lexer.State = PQP.Lexer.stateFrom(document.getText());
    const maybeLine: undefined | PQP.Lexer.TLine = lexResult.lines[position.line];

    return maybeLine !== undefined ? maybeLine.tokens : undefined;
}

function maybeTokenAt(textDocumentPosition: LS.TextDocumentPositionParams): undefined | PQP.LineToken {
    const maybeLineTokens: undefined | ReadonlyArray<PQP.LineToken> = maybeLineTokensAt(textDocumentPosition);
    if (maybeLineTokens === undefined) {
        return undefined;
    }
    const lineTokens: ReadonlyArray<PQP.LineToken> = maybeLineTokens;

    const position: LS.Position = textDocumentPosition.position;
    for (const token of lineTokens) {
        if (token.positionStart <= position.character && token.positionEnd >= position.character) {
            return token;
        }
    }

    return undefined;
}

// TODO: make completion requests context sensitive
connection.onCompletion((_textDocumentPosition: LS.TextDocumentPositionParams): LS.CompletionItem[] => {
    return defaultCompletionItems;
});

connection.onHover(
    (textDocumentPosition: LS.TextDocumentPositionParams): LS.Hover => {
        let hover: LS.Hover = {
            range: undefined,
            contents: [],
        };

        const maybeDocumentSymbol: undefined | DocumentSymbol = maybeDocumentSymbolDefinitionAt(textDocumentPosition);
        if (maybeDocumentSymbol && maybeDocumentSymbol.definition) {
            const position: LS.Position = textDocumentPosition.position;
            const range: LS.Range = {
                start: {
                    line: position.line,
                    character: maybeDocumentSymbol.token.positionStart,
                },
                end: {
                    line: position.line,
                    character: maybeDocumentSymbol.token.positionEnd,
                },
            };
            hover = LanguageServiceHelpers.libraryDefinitionToHover(maybeDocumentSymbol.definition, range);
        }

        return hover;
    },
);

interface Inspectable {
    nodeIdMapCollection: PQP.NodeIdMap.Collection;
    leafNodeIds: ReadonlyArray<number>;
}

connection.onSignatureHelp(
    (textDocumentPosition: LS.TextDocumentPositionParams): LS.SignatureHelp => {
        let signatureHelp: LS.SignatureHelp = {
            signatures: [],
            // tslint:disable-next-line: no-null-keyword
            activeParameter: null,
            activeSignature: 0,
        };

        const maybeDocument: undefined | LS.TextDocument = documents.get(textDocumentPosition.textDocument.uri);
        if (maybeDocument === undefined) {
            return signatureHelp;
        }

        const document: LS.TextDocument = maybeDocument;
        const lexResult: PQP.Lexer.State = PQP.Lexer.stateFrom(document.getText());
        const triedSnapshot: PQP.TriedLexerSnapshot = PQP.LexerSnapshot.tryFrom(lexResult);
        if (triedSnapshot.kind === PQP.ResultKind.Ok) {
            const triedParser: PQP.Parser.TriedParse = PQP.Parser.tryParse(triedSnapshot.value);
            let inspectableParser: Inspectable | undefined;
            if (triedParser.kind === PQP.ResultKind.Ok) {
                inspectableParser = triedParser.value;
            } else if (triedParser.error instanceof PQP.ParserError.ParserError) {
                inspectableParser = triedParser.error.context;
            }

            if (inspectableParser) {
                const position: PQP.Inspection.Position = {
                    lineNumber: textDocumentPosition.position.line,
                    lineCodeUnit: textDocumentPosition.position.character,
                };

                const triedInspection: PQP.Inspection.TriedInspect = PQP.Inspection.tryFrom(
                    position,
                    inspectableParser.nodeIdMapCollection,
                    inspectableParser.leafNodeIds,
                );

                if (triedInspection.kind === PQP.ResultKind.Ok) {
                    // TODO: not sure if taking the first node is correct
                    if (
                        triedInspection.value.nodes.length > 0 &&
                        triedInspection.value.nodes[0].kind === PQP.Inspection.NodeKind.InvokeExpression
                    ) {
                        const invokeExpressionNode: PQP.Inspection.InvokeExpression = triedInspection.value
                            .nodes[0] as PQP.Inspection.InvokeExpression;
                        const functionName: string | undefined = invokeExpressionNode.maybeName;

                        if (functionName) {
                            const libraryDefinition: LibraryDefinition | undefined = pqLibrary.get(functionName);
                            if (libraryDefinition) {
                                let argumentOrdinal: number | undefined;
                                if (invokeExpressionNode.maybeArguments) {
                                    argumentOrdinal = invokeExpressionNode.maybeArguments.positionArgumentIndex;
                                }

                                const signatures: LS.SignatureInformation[] = LanguageServiceHelpers.signaturesToSignatureInformation(
                                    libraryDefinition.signatures,
                                );

                                signatureHelp = {
                                    signatures: signatures,
                                    // tslint:disable-next-line: no-null-keyword
                                    activeParameter: argumentOrdinal ? argumentOrdinal : null,
                                    activeSignature: signatures.length - 1,
                                };
                            }
                        }
                    }
                }
            }
        }

        return signatureHelp;
    },
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

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log("We received an file change event");
});

*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
