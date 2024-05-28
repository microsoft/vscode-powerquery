// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";
import { LibrarySymbol, PowerQueryApi } from "../../powerQueryApi";

type PartialDiagnostic = Partial<vscode.Diagnostic> & { severity: vscode.DiagnosticSeverity };

suite("Diagnostics: Simple", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("diagnostics.pq");

    suiteSetup(async () => await TestUtils.closeFileIfOpen(docUri));

    test("Simple diagnostics test", async () =>
        await testDiagnostics(docUri, [
            {
                message:
                    "Expected to find a equal operator <'='>, but a not equal to operator ('<>') was found instead",
                range: new vscode.Range(0, 9, 0, 12),
                severity: vscode.DiagnosticSeverity.Error,
            },
        ]));
});

suite("Diagnostics: No errors", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.NoErrors.pq");

    suiteSetup(async () => await TestUtils.closeFileIfOpen(docUri));

    test("No errors", async () => await testDiagnostics(docUri, []));
});

suite("Diagnostics: External Library Symbols", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.ExternalLibrarySymbol.pq");
    const testLibraryName: string = "TestLibrary";

    const expectedDiagnostic: PartialDiagnostic = {
        message: "Cannot find the name 'TestSymbol.ShouldNotExistOrMatchExisting'.",
        range: new vscode.Range(0, 0, 0, 22),
        severity: vscode.DiagnosticSeverity.Error,
    };

    let extensionApi: PowerQueryApi;

    suiteSetup(async () => {
        extensionApi = await TestUtils.activateExtension();
    });

    // Closing the file after every test ensures no state conflicts.
    teardown(async () => await TestUtils.closeFileIfOpen(docUri));

    test("Missing symbol", async () => {
        await testDiagnostics(docUri, [expectedDiagnostic]);
    });

    test("Add symbol", async () => {
        const extensionApi: PowerQueryApi = await TestUtils.activateExtension();

        const symbol: LibrarySymbol = {
            name: "TestSymbol.ShouldNotExistOrMatchExisting",
            documentation: null,
            completionItemKind: 3,
            functionParameters: null,
            isDataSource: false,
            type: "any",
        };

        const symbolMap: ReadonlyMap<string, LibrarySymbol[]> = new Map([[testLibraryName, [symbol]]]);

        await extensionApi.addLibrarySymbols(symbolMap);

        await testDiagnostics(docUri, []);
    });

    test("Remove symbol", async () => {
        await extensionApi.removeLibrarySymbols([testLibraryName]);

        await testDiagnostics(docUri, [expectedDiagnostic]);
    });
});

suite("Diagnostics: Experimental", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("Diagnostics.TableIsEmpty.Error.pq");

    suiteSetup(async () => await TestUtils.closeFileIfOpen(docUri));

    test("No error reported with default settings", async () => {
        await testDiagnostics(docUri, []);
    });

    // TODO: Tests that change the local configuration settings.
    // Investigate support for scoped settings / Document Settings.
});

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: PartialDiagnostic[]): Promise<void> {
    const editor: vscode.TextEditor = await TestUtils.activate(docUri);

    // Add a short delay to ensure the diagnostics are computed.
    // Diagnostics tests can be flaky without this delay.
    await TestUtils.delay(10);
    const actualDiagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(editor.document.uri);

    // Special handling for common case
    if (expectedDiagnostics.length === 0 && actualDiagnostics.length !== 0) {
        assert.fail(`Expected 0 diagnostics but received: ${JSON.stringify(actualDiagnostics, undefined, 2)}`);
    }

    assert.equal(
        actualDiagnostics.length,
        expectedDiagnostics.length,
        `Expected ${expectedDiagnostics.length} diagnostics by received ${actualDiagnostics.length}`,
    );

    expectedDiagnostics.forEach((expectedDiagnostic: PartialDiagnostic, index: number) => {
        const actualDiagnostic: vscode.Diagnostic | undefined = actualDiagnostics[index];

        assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);

        if (expectedDiagnostic.message !== undefined) {
            assert.equal(actualDiagnostic?.message, expectedDiagnostic.message);
        }

        if (expectedDiagnostic.range === undefined) {
            assert.deepEqual(actualDiagnostic?.range, expectedDiagnostic.range);
        }
    });
}
