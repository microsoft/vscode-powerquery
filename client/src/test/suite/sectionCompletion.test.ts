// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as CompletionUtils from "./completionUtils";
import * as TestUtils from "./testUtils";

suite("Section document", async () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("section.pq");
    await vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

    test("Keywords", async () => {
        await CompletionUtils.testCompletion(
            docUri,
            new vscode.Position(12, 5),
            {
                items: [
                    { label: "if", kind: vscode.CompletionItemKind.Keyword },
                    { label: "is", kind: vscode.CompletionItemKind.Keyword },
                    { label: "in", kind: vscode.CompletionItemKind.Keyword },
                ],
            },
            CompletionUtils.VertificationType.Contains,
        );
    });

    test("Section members", async () => {
        await CompletionUtils.testCompletion(
            docUri,
            new vscode.Position(11, 12),
            {
                items: [
                    { label: "firstMember", kind: vscode.CompletionItemKind.Value },
                    { label: "secondMember", kind: vscode.CompletionItemKind.Value },
                    { label: "thirdMember", kind: vscode.CompletionItemKind.Function },
                ],
            },
            CompletionUtils.VertificationType.Contains,
        );
    });
});
