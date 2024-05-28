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
});
