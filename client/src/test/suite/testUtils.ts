// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

export const extensionId: string = "powerquery.vscode-powerquery";

/**
 * Activates the vscode-powerquery extension
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
    // The extensionId is `publisher.name` from package.json
    const ext: vscode.Extension<any> | undefined = vscode.extensions.getExtension(extensionId);
    if (!ext) {
        throw new Error("Failed to load extension.");
    }

    await ext.activate();
    try {
        doc = await vscode.workspace.openTextDocument(docUri);
        editor = await vscode.window.showTextDocument(doc);
    } catch (e) {
        console.error(e);
    }
}

export const getDocPath: (p: string) => string = (p: string): string =>
    path.resolve(__dirname, "../../../src/test/testFixture", p);

export const getDocUri: (p: string) => vscode.Uri = (p: string): vscode.Uri => vscode.Uri.file(getDocPath(p));

export async function setTestContent(content: string): Promise<boolean> {
    const all: vscode.Range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
    return editor.edit(eb => eb.replace(all, content));
}

export enum Commands {
    CompletionItems = "vscode.executeCompletionItemProvider",
    DocumentSymbols = "vscode.executeDocumentSymbolProvider",
    Format = "vscode.executeFormatDocumentProvider",
    Hover = "vscode.executeHoverProvider",
    SignatureHelp = "vscode.executeSignatureHelpProvider ",
}
