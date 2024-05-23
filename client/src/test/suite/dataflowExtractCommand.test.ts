// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";
import { CommandConstant } from "../../constants";
import { expect } from "chai";

import * as TestUtils from "./testUtils";

// TODO: We could add command unit tests that use mocks to avoid UI based tests.
suite("Dataflow Extract Command", () => {
    suiteSetup(async () => {
        await TestUtils.activateExtension();
    });

    test("Command is registered", async () => {
        const commands: string[] = [CommandConstant.ExtractDataflowDocument];

        const pqCommands: string[] = (await vscode.commands.getCommands(/* filterInternal */ true)).filter(
            (cmd: string) => cmd.startsWith("powerquery."),
        );

        commands.forEach((cmd: string) => assert(pqCommands.includes(cmd), `Command not found: ${cmd}`));
    });

    test("Extract command", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("dataflow.json");
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);

        await vscode.window.showTextDocument(doc);

        const newDocUri: vscode.Uri | undefined = await vscode.commands.executeCommand(
            CommandConstant.ExtractDataflowDocument,
        );

        expect(newDocUri !== undefined, "command did not return new document URI");
    });
});
