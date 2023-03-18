// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as vscode from "vscode";
import path = require("path");
import { DataflowModel } from "./dataflowModel";

function getSetting(config: string, setting: string): string {
    const value: string | undefined = vscode.workspace.getConfiguration(config).get(setting);

    if (value == undefined) {
        return "";
    }

    return value;
}

async function processText(
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit,
    processingFunction: (selection: string) => string,
): Promise<void> {
    const selectionSeparator: string = "\n-----------------------------\n";
    const target: string = getSetting("powerquery.editor", "transformTarget");

    try {
        let textForClipboard: string = "";

        switch (target) {
            case "clipboard":
                textEditor.selections.forEach(async (selection: vscode.Selection) => {
                    try {
                        const replacement: string = processingFunction(textEditor.document.getText(selection));

                        if (textForClipboard.length > 0) {
                            textForClipboard += selectionSeparator;
                        }

                        textForClipboard += replacement;
                    } catch (err) {
                        await vscode.window.showErrorMessage(`Failed to transform text. Error: ${err}`);
                    }
                });

                await vscode.env.clipboard.writeText(textForClipboard);
                break;
            case "inPlace":
            default:
                textEditor.selections.forEach(async (selection: vscode.Selection) => {
                    try {
                        const replacement: string = processingFunction(textEditor.document.getText(selection));
                        edit.replace(selection, replacement);
                    } catch (err) {
                        await vscode.window.showErrorMessage(`Failed to transform text. Error: ${err}`);
                    }
                });
        }
    } catch (err) {
        await vscode.window.showErrorMessage(`Failed to transform text to ${target}. Error: ${err}`);
    }
}

// https://docs.microsoft.com/en-us/powerquery-m/m-spec-lexical-structure#character-escape-sequences

// TODO: Support arbitrary escape sequence lists: #(cr,cr,cr)
export async function escapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): Promise<void> {
    await processText(textEditor, edit, PQP.Language.TextUtils.escape);
}

export async function unescapeMText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): Promise<void> {
    await processText(textEditor, edit, PQP.Language.TextUtils.unescape);
}

export async function escapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): Promise<void> {
    await processText(textEditor, edit, JSON.stringify);
}

export async function unescapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): Promise<void> {
    await processText(textEditor, edit, removeJsonEncoding);
}

export async function extractDataflowDocument(): Promise<vscode.Uri | undefined> {
    const textEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

    if (!textEditor) {
        return undefined;
    }

    let dataflow: DataflowModel;

    try {
        dataflow = JSON.parse(textEditor.document.getText());
    } catch (err) {
        await vscode.window.showErrorMessage(`Failed to parse document. Error: ${JSON.stringify(err)}`);

        return undefined;
    }

    if (!dataflow || !dataflow["pbi:mashup"]?.document) {
        await vscode.window.showErrorMessage(`Failed to parse document as a dataflow.json model`);

        return undefined;
    }

    const mashupDocument: string = dataflow["pbi:mashup"].document;

    const headerComments: string[] = [
        `// name: ${dataflow.name}`,
        `// dataflowId: ${dataflow["ppdf:dataflowId"]}`,
        `// modifiedTime: ${dataflow.modifiedTime}`,
    ];

    const content: string = `${headerComments.join("\r\n")}\r\n${mashupDocument}`;

    const workspaceRoot: string = path.dirname(textEditor.document.fileName);

    const currentEditorFileName: string = path.basename(
        textEditor.document.fileName,
        path.extname(textEditor.document.fileName),
    );

    const newFileUri: vscode.Uri = vscode.Uri.parse(
        `untitled:${path.join(workspaceRoot, `${currentEditorFileName}.pq`)}`,
    );

    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(newFileUri);
    const contentEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    contentEdit.insert(document.uri, new vscode.Position(0, 0), content);
    await vscode.workspace.applyEdit(contentEdit);

    // TODO: Can this be read from user settings/preferences?
    // The format command returns an error if we don't pass in any options.
    const formattingOptions: vscode.FormattingOptions = {
        tabSize: 4,
        insertSpaces: true,
    };

    const textEdits: vscode.TextEdit[] = await vscode.commands.executeCommand(
        "vscode.executeFormatDocumentProvider",
        document.uri,
        formattingOptions,
    );

    const formatEdit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    formatEdit.set(document.uri, textEdits as vscode.TextEdit[]);

    await vscode.workspace.applyEdit(formatEdit);

    await vscode.window.showTextDocument(document);

    return document.uri;
}

function removeJsonEncoding(text: string): string {
    return JSON.parse(text);
}
