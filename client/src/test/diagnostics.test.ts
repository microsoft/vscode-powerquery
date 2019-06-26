// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";
import { activate, getDocUri } from "./helper";

describe("Should get diagnostics", () => {
    const docUri: vscode.Uri = getDocUri("diagnostics.pq");

    it("Simple test", async () => {
        await testDiagnostics(docUri, [
            {
                message: "Expected to find a Equal on line 0, column 9, but a KeywordNot was found instead.",
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
    await activate(docUri);

    const actualDiagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(docUri);

    assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

    expectedDiagnostics.forEach((expectedDiagnostic, i) => {
        const actualDiagnostic: vscode.Diagnostic = actualDiagnostics[i];
        assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
        assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
        assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
    });
}
