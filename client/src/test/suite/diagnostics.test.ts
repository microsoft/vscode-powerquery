// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

suite("Should get diagnostics", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("diagnostics.pq");
    vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

    test("Simple diagnostics test", async () => {
        testDiagnostics(docUri, [
            {
                message: "Expected to find a Equal on line 1, column 10, but a KeywordNot was found instead.",
                range: toRange(0, 9, 0, 12),
                severity: vscode.DiagnosticSeverity.Error,
            },
        ]);
    });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number): vscode.Range {
    const start: vscode.Position = new vscode.Position(sLine, sChar);
    const end: vscode.Position = new vscode.Position(eLine, eChar);
    return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]): Promise<void> {
    await TestUtils.activate(docUri);

    const actualDiagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(docUri);

    assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

    expectedDiagnostics.forEach((expectedDiagnostic, i) => {
        const actualDiagnostic: vscode.Diagnostic = actualDiagnostics[i];
        assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
        assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
        assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    });
}
