// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import * as vscode from "vscode";
import path = require("path");
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

function GetSetting(config: string, setting: string): string {
    const value: string | undefined = vscode.workspace.getConfiguration(config).get(setting);

    if (value == undefined) {
        return "";
    }

    return value;
}

export function unescapeJsonText(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
    textEditor.selections.forEach(async (selection: vscode.Selection) => {
        try {
            const replacement: string = removeJsonEncoding(textEditor.document.getText(selection));

            const target: string = GetSetting("powerquery.editor", "transformTarget");
            // await vscode.window.showInformationMessage(`Target: ${target}`);

            switch (target) {
                case "clipboard":
                    await vscode.env.clipboard.writeText(replacement);
                    break;
                case "inPlace":
                default:
                    edit.replace(selection, replacement);
            }
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${err}`);
        }
    });
}

export function unescapeJsonTextToClipboard(textEditor: vscode.TextEditor): void {
    textEditor.selections.forEach(async (selection: vscode.Selection) => {
        try {
            const replacement: string = removeJsonEncoding(textEditor.document.getText(selection));
            await vscode.env.clipboard.writeText(replacement);
        } catch (err) {
            await vscode.window.showErrorMessage(`Failed to unescape as JSON. Error: ${JSON.stringify(err)}`);
        }
    });
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
