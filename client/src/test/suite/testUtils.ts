// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { PowerQueryApi } from "../../powerQueryApi";

const testFixurePath: string = "../../../src/test/testFixture";

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

export async function activateExtension(): Promise<PowerQueryApi> {
    // The extensionId is `publisher.name` from package.json
    const ext: vscode.Extension<PowerQueryApi> | undefined = vscode.extensions.getExtension(extensionId);

    if (!ext) {
        throw new Error("Failed to load extension.");
    }

    if (ext.isActive) {
        return ext.exports;
    }

    return await ext.activate();
}

export async function closeFileIfOpen(file: vscode.Uri): Promise<void> {
    const tabs: vscode.Tab[] = vscode.window.tabGroups.all.map((tg: vscode.TabGroup) => tg.tabs).flat();

    const index: number = tabs.findIndex(
        (tab: vscode.Tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.path === file.path,
    );

    if (index !== -1) {
        await vscode.window.tabGroups.close(tabs[index]);
    }
}

export function getTestFixturePath(): string {
    return path.resolve(__dirname, testFixurePath);
}

export const getDocPath: (p: string) => string = (p: string): string => path.resolve(getTestFixturePath(), p);

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

export const randomDirName: (length?: number) => string = (length: number = 8): string =>
    path.resolve(os.tmpdir(), Math.random().toString(16).substring(2, length));
