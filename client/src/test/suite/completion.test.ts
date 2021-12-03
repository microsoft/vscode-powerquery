// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as CompletionUtils from "./completionUtils";
import * as TestUtils from "./testUtils";

// See https://code.visualstudio.com/api/references/commands for full list of commands.

// TODO: Add test mechanism that uses | notation and uses testUtils.setTestContent
// TODO: Add test case for identifier with trailing. ex - "Access.|"

suite("Access.Dat completion", async () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("completion.pq");
    vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

    // TODO: Test runs fine under VS Code debugger, but fails when run from npm command line.
    // Investigate moving to @vscode/test-electron as described in the latest docs.
    // https://code.visualstudio.com/api/working-with-extensions/testing-extension
    test("Simple completion item test", async () => {
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
