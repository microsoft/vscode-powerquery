// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as CompletionUtils from "./completionUtils";
import * as TestUtils from "./testUtils";

// See https://code.visualstudio.com/api/references/commands for full list of commands.

// TODO: Add test mechanism that uses | notation and uses testUtils.setTestContent
// TODO: Add test case for identifier with trailing. ex - "Access.|"

suite("Access.Dat completion", () => {
    test("Simple completion item test", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("completion.pq");

        await CompletionUtils.testCompletion(
            docUri,
            new vscode.Position(0, 9),
            {
                items: [{ label: "Access.Database", kind: vscode.CompletionItemKind.Function }],
            },
            CompletionUtils.VertificationType.Contains,
        );
    });
});
