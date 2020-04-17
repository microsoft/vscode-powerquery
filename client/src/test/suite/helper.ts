// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as path from "path";
// tslint:disable-next-line: no-implicit-dependencies
import * as vscode from "vscode";

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

/**
 * Activates the vscode-powerquery extension
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
    // The extensionId is `publisher.name` from package.json
    const ext: vscode.Extension<any> | undefined = vscode.extensions.getExtension("powerquery.vscode-powerquery");
    if (ext === undefined) {
        throw new Error("Failed to load extension.");
    }

    await Promise.resolve(ext.activate());
    try {
        doc = await Promise.resolve(vscode.workspace.openTextDocument(docUri));
        editor = await Promise.resolve(vscode.window.showTextDocument(doc));
        await sleep(2000); // Wait for server activation
    } catch (e) {
        // tslint:disable-next-line: no-console
        console.error(e);
    }
}

async function sleep(ms: number): Promise<unknown> {
    // tslint:disable-next-line: no-string-based-set-timeout
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const getDocPath: (p: string) => string = (p: string): string => path.resolve(__dirname, "./testFixture", p);

export const getDocUri: (p: string) => vscode.Uri = (p: string): vscode.Uri => vscode.Uri.file(getDocPath(p));

export async function setTestContent(content: string): Promise<boolean> {
    const all: vscode.Range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
    return editor.edit(eb => eb.replace(all, content));
}
