// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as DocumentSymbolUtils from "./documentSymbolUtils";
import * as TestUtils from "./testUtils";

suite("DocumentSymbols", () => {
    const docUri: vscode.Uri = TestUtils.getDocUri("DocumentSymbols.pq");

    suiteSetup(async () => await TestUtils.closeFileIfOpen(docUri));

    test("DocumentSymbols.pq", async () =>
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
        ]));
});
