// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";

// tslint:disable-next-line: promise-function-async
export function run(): Promise<void> {
    // Create the mocha test
    const mocha: Mocha = new Mocha({
        ui: "tdd",
    });
    mocha.useColors(true);

    const testsRoot: string = path.resolve(__dirname, "..");

    return new Promise((c, e) => {
        glob("**/**.test.js", { cwd: testsRoot }, (err, files) => {
            if (err) {
                // tslint:disable-next-line: no-void-expression
                return e(err);
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                e(err);
            }
        });
    });
}
