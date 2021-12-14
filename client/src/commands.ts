// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

// https://docs.microsoft.com/en-us/powerquery-m/m-spec-lexical-structure#character-escape-sequences
const controlCharacters: Map<string, string> = new Map([
    ["cr", "\r"],
    ["lf", "\n"],
    ["tab", "\t"],
    ["#", "#"],
]);

// TODO: It might be better to implement escape/unescape functions at the powerquery-parser layer.

export function unescapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(selection => {
        let text: string = textEditor.document.getText(selection);

        controlCharacters.forEach((replace, char) => {
            // eslint-disable-next-line security/detect-non-literal-regexp
            const re: RegExp = new RegExp(`#\\(${char}\\)`, "gm");
            text = text.replace(re, replace);
        });

        // Replace "" with "
        const escapedDoubleQuote: RegExp = new RegExp('""', "gm");
        text = text.replace(escapedDoubleQuote, '"');

        // TODO: do we also want to replace unicode characters? #(000D), #(0000000D)
        // TODO: support escape sequence lists: #(cr,lf)

        edit.replace(selection, text);
    });
}
