// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
 
// Guidance from https://code.visualstudio.com/api/working-with-extensions/testing-extension
const { defineConfig } = require('@vscode/test-cli');
 
module.exports = defineConfig([
  {
    label: "UI Tests",
    files: "lib/test/**/*.test.js",
    workspaceFolder: "src/test/testFixture",
    extensionDevelopmentPath: "..",
    launchArgs: ["--profile-temp", "--disable-extensions"],
    
    mocha: {
      color: true,
      ui: "tdd",
      timeout: 20000,
      slow: 10000,
      // TODO: Using mocha-multi-reporters breaks the VS Code test runner. All tests start reporting "Test process exited unexpectedly".
      // reporter: "mocha-multi-reporters",
      // reporterOptions: {
      //   reporterEnabled: "spec, mocha-junit-reporter",
      //   mochaJunitReporterReporterOptions: {
      //     mochaFile: "test-results.xml",
      //   },
      // }
    }
  }
]);