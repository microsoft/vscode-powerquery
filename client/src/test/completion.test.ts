/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from "vscode";
import * as assert from "assert";
import { getDocUri, activate } from "./helper";

describe("Should do completion", () => {
    const docUri = getDocUri("completion.pq");

    it("Simple completion item test", async () => {
        await testCompletion(docUri, new vscode.Position(0, 7), {
            items: [{ label: "Access.Database", kind: vscode.CompletionItemKind.Function }],
        });
    });
});

async function testCompletion(
    docUri: vscode.Uri,
    position: vscode.Position,
    expectedCompletionList: vscode.CompletionList,
    countShouldMatch: boolean = false,
) {
    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
    const actualCompletionList: vscode.CompletionList = await testCompletionBase(docUri, position);

    if (countShouldMatch) {
        assert.equal(
            actualCompletionList.items.length,
            expectedCompletionList.items.length,
            "expected item counts don't match",
        );
    } else {
        assert(
            actualCompletionList.items.length >= expectedCompletionList.items.length,
            "received fewer items than expected",
        );
    }

    expectedCompletionList.items.forEach((expectedItem, i) => {
        const actualItem = actualCompletionList.items[i];
        assert.equal(actualItem.label, expectedItem.label);
        assert.equal(actualItem.kind, expectedItem.kind);
    });
}

async function testCompletionBase(docUri: vscode.Uri, position: vscode.Position): Promise<vscode.CompletionList> {
    await activate(docUri);

    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
    return vscode.commands.executeCommand("vscode.executeCompletionItemProvider", docUri, position);
}
