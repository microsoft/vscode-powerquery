// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import * as vscode from "vscode";

import * as TestUtils from "./testUtils";

suite("Extension Tests", () => {
    test("extension loads", () => {
        assert.ok(vscode.extensions.getExtension(TestUtils.extensionId));
    });

    test("should be able to activate", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ext: vscode.Extension<any> | undefined = vscode.extensions.getExtension(TestUtils.extensionId);

        if (!ext) {
            assert.fail("failed to get extension");
        }

        await ext.activate();
    });
});
