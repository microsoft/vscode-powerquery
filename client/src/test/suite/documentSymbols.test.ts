// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as DocumentSymbolUtils from "./documentSymbolUtils";
import * as TestUtils from "./testUtils";

suite("DocumentSymbols", () => {
    test("section.pq", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("section.pq");
        void vscode.window.showInformationMessage(`Starting tests using based file: ${docUri}`);

        await DocumentSymbolUtils.testDocumentSymbols(docUri, [
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
