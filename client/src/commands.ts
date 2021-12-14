// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

// https://docs.microsoft.com/en-us/powerquery-m/m-spec-lexical-structure#character-escape-sequences

// TODO: It might be better to implement escape/unescape functions at the powerquery-parser layer.
// TODO: Do we also want to replace unicode characters? #(000D), #(0000000D)
// TODO: Support arbitrary escape sequence lists: #(cr,cr,cr)
export function escapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let text: string = textEditor.document.getText(selection);

        text = text.replace(/#\(/gm, "#(#)("); // Needs to be first
        text = text.replace(/\r\n/gm, "#(cr,lf)");
        text = text.replace(/\r/gm, "#(cr)");
        text = text.replace(/\n/gm, "#(lf)");
        text = text.replace(/\t/gm, "#(tab)");
        text = text.replace(/"/gm, '""');

        edit.replace(selection, text);
    });
}

export function unescapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let text: string = textEditor.document.getText(selection);

        text = text.replace(/#\(cr,lf\)/gm, "\r\n");
        text = text.replace(/#\(cr\)/gm, "\r");
        text = text.replace(/#\(lf\)/gm, "\n");
        text = text.replace(/#\(tab\)/gm, "\t");
        text = text.replace(/""/gm, '"');
        text = text.replace(/#\(#\)\(/gm, "#("); // Needs to be last

        edit.replace(selection, text);
    });
}

export function escapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let replacement: string = ensureQuoted(textEditor.document.getText(selection));

        try {
            replacement = JSON.stringify(replacement);
            // Value will contain embedded escaped \" at start and end - we can remove.
            replacement = replacement.replace(/^"\\"/, '"').replace(/\\""$/, '"');

            edit.replace(selection, replacement);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to escape as JSON string. Error: ${JSON.stringify(err)}`);
        }
    });
}

export function unescapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let replacement: string = ensureQuoted(textEditor.document.getText(selection));

        try {
            replacement = JSON.parse(replacement);
            edit.replace(selection, replacement);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${JSON.stringify(err)}`);
        }
    });
}

// If the string starts and ends with double quote, assume that the user selected a full string.
// If either are missing, add quotes on both sides.
function ensureQuoted(original: string): string {
    if (original.startsWith('"') && original.endsWith('"')) {
        return original;
    }

    return '"'.concat(original).concat('"');
}
