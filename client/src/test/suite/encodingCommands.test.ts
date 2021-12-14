// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";
import { Constants } from "../../constants";

import * as TestUtils from "./testUtils";

// TODO: We could add command unit tests that use mocks to avoid UI based tests.
suite("Encode/Decode Commands", async () => {
    suiteSetup(async () => {
        await TestUtils.activateExtension();
    });

    test("Commands are registered", async () => {
        const commands: string[] = [
            Constants.CommandEscapeMText,
            Constants.CommandUnescapeMText,
            Constants.CommandEscapeJsonText,
            Constants.CommandUnescapeJsonText,
        ];

        const pqCommands: string[] = (await vscode.commands.getCommands(/*filterInternal*/ true)).filter(cmd =>
            cmd.startsWith("powerquery."),
        );

        commands.forEach(cmd => assert(pqCommands.includes(cmd), `Command not found: ${cmd}`));
    });

    test("M Escape", async () => {
        const content: string = 'Encode \t\t and \r\n and "quotes" but not this #(tab)';
        const expected: string = 'Encode #(tab)#(tab) and #(cr,lf) and ""quotes"" but not this #(#)(tab)';

        await runEncodeTest(content, expected, Constants.CommandEscapeMText);
    });

    test("M Unescape", async () => {
        const content: string = 'Encode #(tab)#(tab) and #(cr)#(lf) and ""quotes"" but not this #(#)(tab)';
        const expected: string = 'Encode \t\t and \r\n and "quotes" but not this #(tab)';

        await runEncodeTest(content, expected, Constants.CommandUnescapeMText);
    });

    test("JSON Escape", async () => {
        const content: string = 'let\r\n  #"id" = "m text"" here"\r\nin\r\n  #"id"';
        const expected: string = '"let\\r\\n  #\\"id\\" = \\"m text\\"\\" here\\"\\r\\nin\\r\\n  #\\"id\\""';

        await runEncodeTest(content, expected, Constants.CommandEscapeJsonText);
    });

    test("JSON Unescape (existing quotes)", async () => {
        const content: string = '"let\\r\\n  #\\"id\\" = \\"m text\\"\\" here\\"\\r\\nin\\r\\n  #\\"id\\""';
        const expected: string = 'let\r\n  #"id" = "m text"" here"\r\nin\r\n  #"id"';

        await runEncodeTest(content, expected, Constants.CommandUnescapeJsonText);
    });

    test("JSON Unescape (no quotes)", async () => {
        const content: string = 'let\\r\\n  #\\"id\\" = \\"m text\\"\\" here\\"\\r\\nin\\r\\n  #\\"id\\"';
        const expected: string = 'let\r\n  #"id" = "m text"" here"\r\nin\r\n  #"id"';

        await runEncodeTest(content, expected, Constants.CommandUnescapeJsonText);
    });
});

async function runEncodeTest(original: string, expected: string, command: string): Promise<void> {
    const doc: vscode.TextDocument = await vscode.workspace.openTextDocument({
        language: "powerquery",
        content: original,
    });

    // Use a large range to select the entire document
    const editor: vscode.TextEditor = await vscode.window.showTextDocument(doc);
    editor.selection = new vscode.Selection(0, 0, 9999, 9999);

    await vscode.commands.executeCommand(command);

    const currentText: string = doc.getText();
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    assert(expected === currentText, `expected strings to be equal. Expected: ${expected} Actual: ${currentText}`);

    return;
}
