// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as vscode from "vscode";

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
            const replacement: string = JSON.parse(textEditor.document.getText(selection));
            edit.replace(selection, replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${JSON.stringify(err)}`);
        }
    });
}
