// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

suite("Extension Tests", () => {
    test("extension loads", () => {
        assert.ok(vscode.extensions.getExtension(TestUtils.extensionId));
    });

    test("should be able to activate", () => {
        const ext = vscode.extensions.getExtension(TestUtils.extensionId);
        assert.notEqual(ext, null);
        return ext!.activate().then(() => {
            assert.ok(true);
        });
    }).timeout(10000);
});
