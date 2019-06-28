// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// tslint:disable-next-line: no-submodule-imports
import * as testRunner from "vscode/lib/testrunner";

testRunner.configure({
    ui: "bdd",
    useColors: true,
    timeout: 100000,
});

module.exports = testRunner;
