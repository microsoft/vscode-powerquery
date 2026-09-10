// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
 
// Guidance from https://code.visualstudio.com/api/working-with-extensions/testing-extension
const { defineConfig } = require('@vscode/test-cli');
const path = require('path');
 
module.exports = defineConfig([
  {
    label: "UI Tests",
    files: "lib/test/**/!(multiRootWorkspace).test.js",
    workspaceFolder: "src/test/testFixture",
    extensionDevelopmentPath: "..",
    launchArgs: ["--profile-temp", "--disable-extensions"],
    
    mocha: {
      color: true,
      ui: "tdd",
      timeout: 20000,
      slow: 10000,
      reporter: path.resolve(__dirname, "mochaReporter.js"),
      reporterOptions: {
        output: path.resolve(__dirname, "test-results/ui/test-results.xml"),
      },
    }
  },
  {
    label: "Multi-root Workspace Tests",
    files: "lib/test/**/multiRootWorkspace.test.js",
    workspaceFolder: "src/test/multiRootFixture/test.code-workspace",
    extensionDevelopmentPath: "..",
    launchArgs: ["--profile-temp", "--disable-extensions"],

    mocha: {
      color: true,
      ui: "tdd",
      timeout: 20000,
      slow: 10000,
      reporter: path.resolve(__dirname, "mochaReporter.js"),
      reporterOptions: {
        output: path.resolve(__dirname, "test-results/multi-root/test-results.xml"),
      },
    }
  }
]);