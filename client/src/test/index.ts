/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// tslint:disable-next-line: no-submodule-imports
import * as testRunner from "vscode/lib/testrunner";

testRunner.configure({
    ui: "bdd",
    useColors: true,
    timeout: 100000,
});

module.exports = testRunner;
