// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";
import { activate, getDocUri } from "./helper";

enum VertificationType {
    Exact,
    Ordered,
    Contains,
}

// See https://code.visualstudio.com/api/references/commands for full list of commands.

// TODO: Add test mechanism that uses | notation and doesn't require use of files.
// TODO: Add test case for identifier with trailing. ex - "Access.|"

describe("Access.Dat completion", () => {
    const docUri: vscode.Uri = getDocUri("completion.pq");

    it("Simple completion item test", async () => {
        await testCompletion(
            docUri,
            new vscode.Position(0, 10),
            {
                items: [{ label: "Access.Database", kind: vscode.CompletionItemKind.Function }],
            },
            VertificationType.Contains,
        );
    });
});

describe("Section document", () => {
    const docUri: vscode.Uri = getDocUri("section.pq");

    it("Keywords", async () => {
        await testCompletion(
            docUri,
            new vscode.Position(12, 5),
            {
                items: [
                    { label: "if", kind: vscode.CompletionItemKind.Keyword },
                    { label: "is", kind: vscode.CompletionItemKind.Keyword },
                    { label: "in", kind: vscode.CompletionItemKind.Keyword },
                ],
            },
            VertificationType.Contains,
        );
    });

    it("Section members", async () => {
        await testCompletion(
            docUri,
            new vscode.Position(11, 12),
            {
                items: [
                    { label: "firstMember", kind: vscode.CompletionItemKind.Value },
                    { label: "secondMember", kind: vscode.CompletionItemKind.Value },
                    { label: "thirdMember", kind: vscode.CompletionItemKind.Function },
                ],
            },
            VertificationType.Contains,
        );
    });
});

async function testCompletion(
    docUri: vscode.Uri,
    position: vscode.Position,
    expectedCompletionList: vscode.CompletionList,
    vertification: VertificationType,
): Promise<void> {
    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
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
            "received fewer items than expected",
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
    await activate(docUri);

    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
    return vscode.commands.executeCommand("vscode.executeCompletionItemProvider", docUri, position);
}
