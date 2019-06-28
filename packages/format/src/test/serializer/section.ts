// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { compare, runFormat } from "./common";

describe("section", () => {
    describe("Section", () => {
        it("section;", () => {
            const expected: string = `section;`;
            const actual: string = runFormat(`section;`);
            compare(expected, actual);
        });

        it("section name;", () => {
            const expected: string = `section name;`;
            const actual: string = runFormat(`section name;`);
            compare(expected, actual);
        });

        it("[] section name;", () => {
            const expected: string = `[] section name;`;
            const actual: string = runFormat(`[] section name;`);
            compare(expected, actual);
        });

        it("[] section;", () => {
            const expected: string = `[] section;`;
            const actual: string = runFormat(`[] section;`);
            compare(expected, actual);
        });

        it("[a = 1] section;", () => {
            const expected: string = `[a = 1] section;`;
            const actual: string = runFormat(`[a = 1] section;`);
            compare(expected, actual);
        });

        it("[a = {}] section;", () => {
            const expected: string = `[a = {}] section;`;
            const actual: string = runFormat(`[a = {}] section;`);
            compare(expected, actual);
        });

        it("[a = 1, b = 2] section;", () => {
            const expected: string = `
[
    a = 1,
    b = 2
]
section;`;
            const actual: string = runFormat(`[a=1, b=2] section;`);
            compare(expected, actual);
        });

        it("[a = {}, b = {}] section;", () => {
            const expected: string = `
[
    a = {},
    b = {}
]
section;`;
            const actual: string = runFormat(`[a = {}, b = {}] section;`);
            compare(expected, actual);
        });

        it("[a = {1}, b = {2}] section;", () => {
            const expected: string = `
[
    a = {
        1
    },
    b = {
        2
    }
]
section;`;
            const actual: string = runFormat(`[a = {1}, b = {2}] section;`);
            compare(expected, actual);
        });

        it("[a = 1, b = [c = {2, 3, 4}], e = 5] section;", () => {
            const expected: string = `
[
    a = 1,
    b = [
        c = {
            2,
            3,
            4
        }
    ],
    e = 5
]
section;`;
            const actual: string = runFormat(`[a = 1, b = [c = {2, 3, 4}], e = 5] section;`);
            compare(expected, actual);
        });
    });

    describe("SectionMember", () => {
        it("section; x = 1;", () => {
            const expected: string = `
section;

x = 1;`;
            const actual: string = runFormat(`section; x = 1;`);
            compare(expected, actual);
        });

        it("section; [] x = 1;", () => {
            const expected: string = `
section;

[] x = 1;`;
            const actual: string = runFormat(`section; [] x = 1;`);
            compare(expected, actual);
        });

        it("section; [a=1, b=2] x = 1;", () => {
            const expected: string = `
section;

[
    a = 1,
    b = 2
]
x = 1;`;
            const actual: string = runFormat(`section; [a=1, b=2] x = 1;`);
            compare(expected, actual);
        });

        it("section; [a=1, b=2] shared x = 1;", () => {
            const expected: string = `
section;

[
    a = 1,
    b = 2
]
shared x = 1;`;
            const actual: string = runFormat(`section; [a=1, b=2] shared x = 1;`);
            compare(expected, actual);
        });

        it("section; [a = 1] x = 1;", () => {
            const expected: string = `
section;

[a = 1] x = 1;`;
            const actual: string = runFormat(`section; [a = 1] x = 1;`);
            compare(expected, actual);
        });

        it("section; [a = 1] shared x = 1;", () => {
            const expected: string = `
section;

[a = 1] shared x = 1;`;
            const actual: string = runFormat(`section; [a = 1] shared x = 1;`);
            compare(expected, actual);
        });

        it("section; x = 1; y = 2;", () => {
            const expected: string = `
section;

x = 1;

y = 2;`;
            const actual: string = runFormat(`section; x = 1; y = 2;`);
            compare(expected, actual);
        });

        it("section; Other = 3; Constant.Alpha = 1; Constant.Beta = 2; Other = 3;", () => {
            const expected: string = `
section;

Other = 3;

Constant.Alpha = 1;
Constant.Beta = 2;

Other = 3;`;
            const actual: string = runFormat(`section; Other = 3; Constant.Alpha = 1; Constant.Beta = 2; Other = 3;`);
            compare(expected, actual);
        });
    });
});
