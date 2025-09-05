// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";
import { Commands } from "./testUtils";

export enum VertificationType {
    Exact,
    Ordered,
    Contains,
}

export async function testCompletion(
    docUri: vscode.Uri,
    position: vscode.Position,
    expectedCompletionList: vscode.CompletionList,
    vertification: VertificationType,
): Promise<void> {
    await vscode.workspace.openTextDocument(docUri);

    const actualCompletionList: vscode.CompletionList | undefined = await testCompletionBase(docUri, position);

    if (actualCompletionList === undefined) {
        throw new Error("CompletionList is undefined");
    }

    if (vertification === VertificationType.Exact) {
        assert.equal(
            actualCompletionList.items.length,
            expectedCompletionList.items.length,
            "expected item counts don't match",
        );
    } else {
        assert(
            actualCompletionList.items.length >= expectedCompletionList.items.length,
            `received fewer items (${actualCompletionList.items.length}) than expected (${expectedCompletionList.items.length})`,
        );
    }

    if (vertification === VertificationType.Exact || vertification === VertificationType.Ordered) {
        expectedCompletionList.items.forEach((expectedItem: vscode.CompletionItem, index: number) => {
            const actualItem: vscode.CompletionItem | undefined = actualCompletionList.items.at(index);
            assert.equal(actualItem?.label, expectedItem.label);
            assert.equal(actualItem?.kind, expectedItem.kind);
        });
    } else {
        expectedCompletionList.items.forEach((expectedItem: vscode.CompletionItem) => {
            const filteredItems: vscode.CompletionItem[] = actualCompletionList.items.filter(
                (item: vscode.CompletionItem) => item.label === expectedItem.label,
            );

            assert.equal(filteredItems.length, 1, `expected to find one item with label '${expectedItem.label}'`);

            assert.equal(
                filteredItems[0].kind,
                expectedItem.kind,
                `item kind mismatch. Label: ${expectedItem.label} Expected: ${expectedItem.kind} Actual: ${filteredItems[0].kind}`,
            );
        });
    }
}

async function testCompletionBase(
    docUri: vscode.Uri,
    position: vscode.Position,
): Promise<vscode.CompletionList | undefined> {
    await TestUtils.activate(docUri);

    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
    return vscode.commands.executeCommand(Commands.CompletionItems, docUri, position);
}
