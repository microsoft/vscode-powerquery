// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

import { PowerQueryApi } from "../../powerQueryApi";

suite("Extension Tests", () => {
    test("extension loads", () => {
        assert.ok(vscode.extensions.getExtension(TestUtils.extensionId));
    });

    test("should be able to activate", async () => {
        const api: PowerQueryApi = await TestUtils.activateExtension();
        assert.ok(api);
    });

    test("recognizes .pqpart section documents as Power Query", async () => {
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(TestUtils.getDocUri("section.pqpart"));
        assert.strictEqual(doc.languageId, "powerquery");
    });

    test("recognizes .resxpart string resources as XML", async () => {
        const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(
            TestUtils.getDocUri("strings.resxpart"),
        );

        assert.strictEqual(doc.languageId, "xml");
    });
});
