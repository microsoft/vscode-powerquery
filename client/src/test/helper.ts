/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import * as vscode from "vscode";

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

/**
 * Activates the vscode-powerquery extension
 */
export async function activate(docUri: vscode.Uri) {
    // The extensionId is `publisher.name` from package.json
    const ext: vscode.Extension<any> = vscode.extensions.getExtension("powerquery.vscode-powerquery")!;
    await ext.activate();
    try {
        doc = await vscode.workspace.openTextDocument(docUri);
        editor = await vscode.window.showTextDocument(doc);
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

export const getDocPath: (p: string) => string = (p: string): string => path.resolve(__dirname, "../../testFixture", p);

export const getDocUri: (p: string) => vscode.Uri = (p: string): vscode.Uri => vscode.Uri.file(getDocPath(p));

export async function setTestContent(content: string): Promise<boolean> {
    const all: vscode.Range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
    return editor.edit(eb => eb.replace(all, content));
}
