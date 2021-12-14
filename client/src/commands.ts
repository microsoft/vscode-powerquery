// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

// TODO: It might be better to implement escape/unescape functions at the powerquery-parser layer.

export function unescapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let text: string = textEditor.document.getText(selection);

        // TODO: Do we also want to replace unicode characters? #(000D), #(0000000D)
        // TODO: Support arbitrary escape sequence lists: #(cr,cr,cr)

        // https://docs.microsoft.com/en-us/powerquery-m/m-spec-lexical-structure#character-escape-sequences
        text = text
            .replace("#(cr)", "\r")
            .replace("#(lf)", "\n")
            .replace("#(tab)", "\t")
            .replace("#(cr,lf)", "\r\n")
            .replace("#(#)", "#")
            .replace('""', '"');

        edit.replace(selection, text);
    });
}
