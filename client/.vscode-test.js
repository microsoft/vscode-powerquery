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
      ui: "tdd",
      timeout: 20000,
      slow: 10000
    }
  }
]);