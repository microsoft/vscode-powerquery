// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";
import { Constants } from "../../constants";

import * as TestUtils from "./testUtils";

suite("M Encode/Decode", async () => {
    test("M Encode", async () => {
        await TestUtils.activateExtension();

        const content: string = "Encode #(tab)";
        const expected: string = "Encode \t";

        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument({
            language: "powerquery",
            content: content,
        });

        const editor: vscode.TextEditor = await vscode.window.showTextDocument(doc);
        editor.selection = new vscode.Selection(0, 0, 0, content.length);

        await vscode.commands.executeCommand(Constants.CommandUnescapeText);

        const currentText: string = doc.getText();
        assert(expected === currentText, "expected strings to be equal");
    });
});
