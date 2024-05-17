// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";

export let documentEol: string;
export let platformEol: string;

export const extensionId: string = "powerquery.vscode-powerquery";

export async function activate(docUri: vscode.Uri): Promise<vscode.TextEditor> {
    await activateExtension();

    try {
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);

        return await vscode.window.showTextDocument(doc);
    } catch (e) {
        console.error(e);
        assert.fail(`Failed to open ${docUri}`);
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

export const getDocPath: (p: string) => string = (p: string): string =>
    path.resolve(__dirname, "../../../src/test/testFixture", p);

export const getDocUri: (p: string) => vscode.Uri = (p: string): vscode.Uri => vscode.Uri.file(getDocPath(p));

export async function setTestContent(
    doc: vscode.TextDocument,
    editor: vscode.TextEditor,
    content: string,
): Promise<boolean> {
    const all: vscode.Range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));

    return await editor.edit((eb: vscode.TextEditorEdit) => eb.replace(all, content));
}

export enum Commands {
    CompletionItems = "vscode.executeCompletionItemProvider",
    DocumentSymbols = "vscode.executeDocumentSymbolProvider",
    Format = "vscode.executeFormatDocumentProvider",
    Hover = "vscode.executeHoverProvider",
    SignatureHelp = "vscode.executeSignatureHelpProvider ",
}
