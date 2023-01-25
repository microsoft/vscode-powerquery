// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as vscode from "vscode";
import { DataflowModel } from "./dataflowModel";

// https://docs.microsoft.com/en-us/powerquery-m/m-spec-lexical-structure#character-escape-sequences

// TODO: Support arbitrary escape sequence lists: #(cr,cr,cr)
export function escapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach((selection: vscode.Selection) => {
        const escapedText: string = PQP.Language.TextUtils.escape(textEditor.document.getText(selection));
        edit.replace(selection, escapedText);
    });
}

export function unescapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach((selection: vscode.Selection) => {
        const unescapedText: string = PQP.Language.TextUtils.unescape(textEditor.document.getText(selection));
        edit.replace(selection, unescapedText);
    });
}

export function escapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(async (selection: vscode.Selection) => {
        try {
            const replacement: string = JSON.stringify(textEditor.document.getText(selection));

            edit.replace(selection, replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to escape as JSON string. Error: ${JSON.stringify(err)}`);
        }
    });
}

export function unescapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(async (selection: vscode.Selection) => {
        try {
            const replacement: string = removeJsonEncoding(textEditor.document.getText(selection));
            edit.replace(selection, replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${JSON.stringify(err)}`);
        }
    });
}

export async function extractDataflowDocument(): Promise<void> {
    const textEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

    if (textEditor) {
        const dataflow: DataflowModel = JSON.parse(textEditor.document.getText());

        if (!dataflow || !dataflow["pbi:mashup"]?.document) {
            await vscode.window.showErrorMessage(`Unable to parse document as a dataflow.json model`);

            return;
        }

        const content: string = dataflow["pbi:mashup"].document;

        // TODO: Can this be read from user settings/preferences?
        // The format command returns an error if we don't pass in any options.
        const formattingOptions: vscode.FormattingOptions = {
            tabSize: 4,
            insertSpaces: true,
        };

        const document: vscode.TextDocument = await vscode.workspace.openTextDocument({
            language: "powerquery",
            content,
        });

        const textEdits: vscode.TextEdit[] = await vscode.commands.executeCommand(
            "vscode.executeFormatDocumentProvider",
            document.uri,
            formattingOptions,
        );

        const edits: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        edits.set(document.uri, textEdits as vscode.TextEdit[]);

        await vscode.workspace.applyEdit(edits);
        await vscode.window.showTextDocument(document);
    }
}

function removeJsonEncoding(text: string): string {
    return JSON.parse(text);
}
