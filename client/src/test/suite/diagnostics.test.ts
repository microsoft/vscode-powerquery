// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies

import * as assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

suite("Should get diagnostics", async () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("diagnostics.pq");
    vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

    test("Simple diagnostics test", async () => {
        await testDiagnostics(docUri, [
            {
                message:
                    "Expected to find a equal operator <'='>, but a not equal to operator ('<>') was found instead",
                range: toRange(0, 9, 0, 12),
                severity: vscode.DiagnosticSeverity.Error,
            },
        ]);
    });
});

suite("Experimental diagnostics", async () => {
    test("No errors", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.NoErrors.pq");
        await testDiagnostics(docUri, []);
    });

    test("No error reported with default settings", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.TableIsEmpty.Error.pq");

        // const settings: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

        // console.log(
        //     `"powerquery.diagnostics.experimental" is set to ${settings.get("powerquery.diagnostics.experimental")}`,
        // );

        // await settings.update("powerquery.diagnostics.experimental", false, vscode.ConfigurationTarget.Workspace, true);
        // console.log(
        //     `"powerquery.diagnostics.experimental" is set to ${settings.get("powerquery.diagnostics.experimental")}`,
        // );

        // console.log(`config: ${JSON.stringify(settings.inspect("powerquery"))}`);

        await testDiagnostics(docUri, []);
    });

    // test("Invoke parameter type error", async () => {
    //     const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.TableIsEmpty.Error.pq");
    //     vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

    //     await TestUtils.activate(docUri);

    //     const settings = vscode.workspace.getConfiguration();
    //     await settings.update(
    //       "powerquery.diagnostics.experimental",
    //       true,
    //       vscode.ConfigurationTarget.Workspace,
    //       false
    //     );

    //     await testDiagnostics(docUri, [
    //         {
    //             message: "'Table.IsEmpty' expected the argument for 'table' to be 'table', but got 'text' instead.",
    //             range: toRange(0, 14, 0, 19),
    //             severity: vscode.DiagnosticSeverity.Error,
    //         },
    //     ]);
    // });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number): vscode.Range {
    const start: vscode.Position = new vscode.Position(sLine, sChar);
    const end: vscode.Position = new vscode.Position(eLine, eChar);
    return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]): Promise<void> {
    await TestUtils.activate(docUri);

    const actualDiagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(docUri);

    // Special handling for common case
    if (expectedDiagnostics.length === 0 && actualDiagnostics.length !== 0) {
        assert.fail(`Expected 0 diagnostics but received: ${JSON.stringify(actualDiagnostics, undefined, 2)}`);
    }

    assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

    expectedDiagnostics.forEach((expectedDiagnostic, i) => {
        const actualDiagnostic: vscode.Diagnostic = actualDiagnostics[i];
        assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
        assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
        assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    });
}
