// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as CompletionUtils from "./completionUtils";
import * as TestUtils from "./testUtils";

suite("Section document", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("section.pq");

    test("Keywords", async () => {
        await CompletionUtils.testCompletion(
            docUri,
            new vscode.Position(3, 14),
            {
                items: [
                    { label: "if", kind: vscode.CompletionItemKind.Keyword },
                    { label: "let", kind: vscode.CompletionItemKind.Keyword },
                    { label: "not", kind: vscode.CompletionItemKind.Keyword },
                    { label: "true", kind: vscode.CompletionItemKind.Keyword },
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
                    { label: "firstMember", kind: vscode.CompletionItemKind.Variable },
                    { label: "secondMember", kind: vscode.CompletionItemKind.Variable },
                    { label: "thirdMember", kind: vscode.CompletionItemKind.Variable },
                ],
            },
            CompletionUtils.VertificationType.Contains,
        );
    });
});
