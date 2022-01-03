// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";

export function run(): Promise<void> {
    // Create the mocha test
    const mocha: Mocha = new Mocha({
        color: true,
        ui: "tdd",
        reporter: "mocha-multi-reporters",
        reporterOptions: {
            reporterEnabled: "spec, mocha-junit-reporter",
            mochaJunitReporterReporterOptions: {
                // Emit the test results to the /client directory
                mochaFile: path.resolve(__dirname, "..", "..", "..", "test-results.xml"),
            },
        },
        slow: 10000,
    });

    const testsRoot: string = path.resolve(__dirname, "..");

    return new Promise((c: (value: void | PromiseLike<void>) => void, e: (reason?: any) => void) => {
        glob("**/**.test.js", { cwd: testsRoot }, (err: Error | null, files: ReadonlyArray<string>) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}
