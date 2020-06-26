// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable: no-implicit-dependencies
import * as vscode from "vscode";

import * as DocumentSymbolUtils from "./documentSymbolUtils";
import * as TestUtils from "./testUtils";

// TODO: match completionUtils

suite("DocumentSymbols", () => {
    test("section.pq", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("section.pq");
        vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

        DocumentSymbolUtils.testDocumentSymbols(docUri, [
            { name: "sectionTest", kind: vscode.SymbolKind.Module },
            { name: "firstMember", kind: vscode.SymbolKind.Number },
            { name: "secondMember", kind: vscode.SymbolKind.String },
            { name: "thirdMember", kind: vscode.SymbolKind.Function },
            {
                name: "letMember",
                kind: vscode.SymbolKind.Variable,
                children: [
                    { name: "a", kind: vscode.SymbolKind.Number },
                    { name: "b", kind: vscode.SymbolKind.Number },
                    { name: "c", kind: vscode.SymbolKind.Number },
                ],
            },
        ]);
    });
});
