// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as LC from "vscode-languageclient/node";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

import { PowerQueryApi } from "../../vscode-powerquery.api";

suite("Language Server Client", () => {
    let client: LC.LanguageClient;

    suiteSetup(async () => {
        const extApi: PowerQueryApi = await TestUtils.activateExtension();
        client = extApi.languageClient;
    });

    test("Client should be active", () => {
        assert(client.isRunning);
    });

    test("Diagnostics request", async () => {
        const docUri: vscode.Uri = TestUtils.getDocUri("diagnostics.pq");
        const document: vscode.TextDocument = await vscode.workspace.openTextDocument(docUri);

        const provider: LC.DiagnosticProviderShape | undefined = client
            .getFeature(LC.DocumentDiagnosticRequest.method)
            ?.getProvider(document);

        assert.ok(provider, "Client did not return diagnostic provider");
    });
});
