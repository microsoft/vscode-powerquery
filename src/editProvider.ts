import { format, FormatError, FormatRequest, IndentationLiteral, NewlineLiteral, Result, ResultKind, SerializerOptions } from "powerquery-format";
import * as vscode from "vscode";
import { CancellationToken, DocumentFormattingEditProvider, FormattingOptions, Range, TextDocument, TextEdit } from "vscode";

export class PowerQueryEditProvider implements DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        _: CancellationToken
    ): Promise<TextEdit[]> {
        const documentText = document.getText();
        if (!documentText) {
            return Promise.resolve([]);
        }

        let indentationLiteral;
        if (options.insertSpaces) {
            indentationLiteral = IndentationLiteral.SpaceX4;
        }
        else {
            indentationLiteral = IndentationLiteral.Tab;
        }

        const serializerOptions: SerializerOptions = {
            indentationLiteral,
            newlineLiteral: NewlineLiteral.Unix
        };
        const formatRequest: FormatRequest = {
            document: documentText,
            options: serializerOptions
        };
        const formatResult: Result<string, FormatError.TFormatError> = format(formatRequest);
        if (formatResult.kind === ResultKind.Ok) {
            return Promise.resolve([
                TextEdit.replace(fullDocumentRange(document), formatResult.value)
            ]);
        }
        else {
            const error = formatResult.error;

            let informationMessage;
            if (FormatError.isTFormatError(error)) {
                informationMessage = error.innerError.message;
            }
            else {
                informationMessage = "An unknown error occured during formatting.";
            }

            vscode.window.showInformationMessage(informationMessage);
            return Promise.reject();
        }
    }
}

function fullDocumentRange(document: TextDocument): Range {
    const lastLineId = document.lineCount - 1;
    return new Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
}
