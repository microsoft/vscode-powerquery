// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

export const extensionId: string = "powerquery.vscode-powerquery";

export async function activate(docUri: vscode.Uri): Promise<void> {
    await activateExtension();

    try {
        doc = await vscode.workspace.openTextDocument(docUri);
        editor = await vscode.window.showTextDocument(doc);
    } catch (e) {
        console.error(e);
    }
}

// eslint-disable-next-line require-await
export async function activateExtension(): Promise<void> {
    // The extensionId is `publisher.name` from package.json

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ext: vscode.Extension<any> | undefined = vscode.extensions.getExtension(extensionId);

    if (!ext) {
        throw new Error("Failed to load extension.");
    }

    return ext.activate();
}

const testFixurePath: string = "../../../src/test/testFixture";

export function getTestFixturePath(): string {
    return path.resolve(__dirname, testFixurePath);
}

export const getDocPath: (p: string) => string = (p: string): string => path.resolve(getTestFixturePath(), p);

export const getDocUri: (p: string) => vscode.Uri = (p: string): vscode.Uri => vscode.Uri.file(getDocPath(p));

// eslint-disable-next-line require-await
export async function setTestContent(content: string): Promise<boolean> {
    const all: vscode.Range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));

    return editor.edit((eb: vscode.TextEditorEdit) => eb.replace(all, content));
}

export enum Commands {
    CompletionItems = "vscode.executeCompletionItemProvider",
    DocumentSymbols = "vscode.executeDocumentSymbolProvider",
    Format = "vscode.executeFormatDocumentProvider",
    Hover = "vscode.executeHoverProvider",
    SignatureHelp = "vscode.executeSignatureHelpProvider ",
}

export const randomDirName: (length?: number) => string = (length: number = 8): string =>
    path.resolve(os.tmpdir(), Math.random().toString(16).substring(2, length));
