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
        let replacement: string = ensureQuoted(textEditor.document.getText(selection));

        try {
            replacement = JSON.stringify(replacement);
            // Value will contain embedded escaped \" at start and end - we can remove.
            replacement = replacement.replace(/^"\\"/, '"').replace(/\\""$/, '"');

            edit.replace(selection, replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to escape as JSON string. Error: ${JSON.stringify(err)}`);
        }
    });
}

export function unescapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(async (selection: vscode.Selection) => {
        let replacement: string = ensureQuoted(textEditor.document.getText(selection));

        try {
            replacement = JSON.parse(replacement);
            edit.replace(selection, replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${JSON.stringify(err)}`);
        }
    });
}

function ensureQuoted(original: string): string {
    return PQP.StringUtils.ensureQuoted(original);
}
