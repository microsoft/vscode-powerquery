// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

// https://docs.microsoft.com/en-us/powerquery-m/m-spec-lexical-structure#character-escape-sequences
const replacementMap: Map<string, string> = new Map([
    ["#(cr,lf)", "\r\n"],
    ["#(cr)", "\r"],
    ["#(lf)", "\n"],
    ["#(tab)", "\t"],
    ['""', '"'],
]);

// TODO: It might be better to implement escape/unescape functions at the powerquery-parser layer.
// TODO: Do we also want to replace unicode characters? #(000D), #(0000000D)
// TODO: Support arbitrary escape sequence lists: #(cr,cr,cr)
export function escapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let text: string = textEditor.document.getText(selection);

        text = text.replace("#(#)", "#");

        replacementMap.forEach((decoded, encoded) => {
            text = text.replace(decoded, encoded);
        });

        edit.replace(selection, text);
    });
}

export function unescapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let text: string = textEditor.document.getText(selection);
        replacementMap.forEach((decoded, encoded) => {
            text = text.replace(encoded, decoded);
        });

        text = text.replace("#(#)", "#");

        edit.replace(selection, text);
    });
}
