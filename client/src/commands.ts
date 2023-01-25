/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable promise/prefer-await-to-then */
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
            const replacement: string = removeJsonEncoding(textEditor.document.getText(selection));
            edit.replace(selection, replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${JSON.stringify(err)}`);
        }
    });
}

export function extractDataflowDocument(): void {
    const textEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

    if (textEditor) {
        // const newFile: vscode.Uri = vscode.Uri.parse(`untitled: ${currentFileName}.pq`);
        // const dataflow: any = JSON.parse(textEditor.document.getText());

        // void vscode.workspace.openTextDocument(newFile).then(document => {
        //     const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
        //     const content: string | undefined = dataflow["pbi:mashup"]?.document as string;
        //     edit.insert(newFile, new vscode.Position(0, 0), content ?? "<did not find document element>");

        //     return vscode.workspace.applyEdit(edit).then(async success => {
        //         if (success) {
        //             await vscode.window.showTextDocument(document);
        //         } else {
        //             await vscode.window.showInformationMessage("Error!");
        //         }
        //     });
        // });

        const dataflow: any = JSON.parse(textEditor.document.getText());
        const content: string | undefined = dataflow["pbi:mashup"]?.document as string;

        // TODO: Can this be read from user settings/preferences?
        const formattingOptions: vscode.FormattingOptions = {
            tabSize: 4,
            insertSpaces: true,
        };

        void vscode.workspace.openTextDocument({ language: "powerquery", content }).then(document => {
            void vscode.commands
                .executeCommand("vscode.executeFormatDocumentProvider", document.uri, formattingOptions)
                .then(textEdits => {
                    const edits: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
                    edits.set(document.uri, textEdits as vscode.TextEdit[]);

                    void vscode.workspace.applyEdit(edits).then(async success => {
                        if (success) {
                            await vscode.window.showTextDocument(document);
                        } else {
                            await vscode.window.showInformationMessage("Error!");
                        }
                    });
                });
        });
    }
}

function removeJsonEncoding(text: string): string {
    return JSON.parse(text);
}
