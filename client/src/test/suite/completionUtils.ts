// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as assert from "assert";
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
        expectedCompletionList.items.forEach((expectedItem, i) => {
            const actualItem: vscode.CompletionItem = actualCompletionList.items[i];
            assert.equal(actualItem.label, expectedItem.label);
            assert.equal(actualItem.kind, expectedItem.kind);
        });
    } else {
        expectedCompletionList.items.forEach(expectedItem => {
            const filteredItems: vscode.CompletionItem[] = actualCompletionList.items.filter(
                item => item.label === expectedItem.label,
            );

            assert.equal(filteredItems.length, 1, `expected to find one item with label '${expectedItem.label}'`);
            assert.equal(filteredItems[0].kind, expectedItem.kind, `item kind mismatch.`);
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
