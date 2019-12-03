import * as path from "path";

import { runTests } from "vscode-test";

// tslint:disable-next-line: typedef
async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        // tslint:disable-next-line: typedef
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to the extension test script
        // Passed to --extensionTestsPath
        // tslint:disable-next-line: typedef
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs: ["--disable-extensions"] });
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.error("Failed to run tests");
        process.exit(1);
    }
}

// tslint:disable-next-line: no-floating-promises
main();
