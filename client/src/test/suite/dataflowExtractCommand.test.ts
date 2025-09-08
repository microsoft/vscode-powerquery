// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import assert from "assert";
import { expect } from "chai";

import * as TestUtils from "./testUtils";
import { CommandConstant } from "../../constants";

// TODO: We could add command unit tests that use mocks to avoid UI based tests.
suite("Dataflow Extract Command", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("dataflow.json");

    suiteSetup(async () => {
        await TestUtils.activateExtension();

        return await TestUtils.closeFileIfOpen(docUri);
    });

    test("Command is registered", async () => {
        const commands: string[] = [CommandConstant.ExtractDataflowDocument];

        const pqCommands: string[] = (await vscode.commands.getCommands(/* filterInternal */ true)).filter(
            (cmd: string) => cmd.startsWith("powerquery."),
        );

        commands.forEach((cmd: string) => assert(pqCommands.includes(cmd), `Command not found: ${cmd}`));
    });

    test("Extract command", async () => {
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);

        await vscode.window.showTextDocument(doc);

        const newDocUri: vscode.Uri | undefined = await vscode.commands.executeCommand(
            CommandConstant.ExtractDataflowDocument,
        );

        expect(newDocUri !== undefined, "command did not return new document URI");

        return await TestUtils.closeFileIfOpen(newDocUri as vscode.Uri);
    });
});
