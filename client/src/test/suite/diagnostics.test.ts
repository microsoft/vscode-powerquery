// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

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

suite("No errors", async () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.NoErrors.pq");

    test("No errors", async () => {
        await testDiagnostics(docUri, []);
    });
});

suite("Experimental diagnostics", async () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.TableIsEmpty.Error.pq");

    test("No error reported with default settings", async () => {
        await testDiagnostics(docUri, []);
    });

    // TODO: Tests that change the local configuration settings.
    // Tried updating settings like this:
    // await settings.update("powerquery.diagnostics.experimental", true, vscode.ConfigurationTarget.Workspace);
    // But it ends up creating a workspace file that impacts other tests and caused flakiness.
    // Helper function to dump current configuration is:
    // console.log(`config: ${JSON.stringify(settings.inspect("powerquery"))}`);
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
        const actualDiagnostic: vscode.Diagnostic | undefined = actualDiagnostics[i];
        assert.equal(actualDiagnostic?.message, expectedDiagnostic.message);
        assert.deepEqual(actualDiagnostic?.range, expectedDiagnostic.range);
        assert.equal(actualDiagnostic?.severity, expectedDiagnostic.severity);
    });
}
