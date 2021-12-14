// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, expect } from "chai";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";
import { Commands } from "./testUtils";

export interface ExpectedDocumentSymbol {
    name: string;
    kind: vscode.SymbolKind;
    children?: ExpectedDocumentSymbol[];
}

export async function testDocumentSymbols(
    docUri: vscode.Uri,
    expectedSymbols: ExpectedDocumentSymbol[],
): Promise<void> {
    await vscode.workspace.openTextDocument(docUri);

    const documentSymbols: vscode.DocumentSymbol[] | undefined = await documentSymbolsBase(docUri);
    if (documentSymbols === undefined) {
        assert.fail("documentSymbols undefined");
    }

    const actualSymbols: ExpectedDocumentSymbol[] = documentSymbolArrayToExpectedSymbols(documentSymbols);
    expect(actualSymbols).deep.equals(expectedSymbols, "Expected document symbols to match.");
}

async function documentSymbolsBase(docUri: vscode.Uri): Promise<vscode.DocumentSymbol[] | undefined> {
    await TestUtils.activate(docUri);

    return vscode.commands.executeCommand(Commands.DocumentSymbols, docUri);
}

function documentSymbolArrayToExpectedSymbols(documentSymbols: vscode.DocumentSymbol[]): ExpectedDocumentSymbol[] {
    const expectedSymbols: ExpectedDocumentSymbol[] = [];
    documentSymbols.forEach(element => {
        let children: ExpectedDocumentSymbol[] | undefined;
        if (element.children && element.children.length > 0) {
            children = documentSymbolArrayToExpectedSymbols(element.children);
            expectedSymbols.push({ name: element.name, kind: element.kind, children });
        } else {
            expectedSymbols.push({ name: element.name, kind: element.kind });
        }
    });
    return expectedSymbols;
}
