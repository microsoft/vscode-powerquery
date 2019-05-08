import "mocha";
import { compare, runFormat } from "./common";

describe("comment serializer", () => {
    // --------------------------------------
    // ---------- RecordExpression ----------
    // --------------------------------------
    describe("RecordExpression", () => {

        it("[ /*foo*/ key1=value1, key2=value2 ]", () => {
            const expected = `
[
    /*foo*/ key1 = value1,
    key2 = value2
]`.trim();
            const actual = runFormat("[ /*foo*/ key1=value1, key2=value2 ]");
            compare(expected, actual);
        });

        it("[ /*foo*//*bar*/ key1=value1, key2=value2 ]", () => {
            const expected = `
[
    /*foo*//*bar*/ key1 = value1,
    key2 = value2
]`.trim();
            const actual = runFormat("[ /*foo*//*bar*/ key1=value1, key2=value2 ]");
            compare(expected, actual);
        });

        it("[ key1=/*foo*/value1, key2=value2 ]", () => {
            const expected = `
[
    key1 = /*foo*/ value1,
    key2 = value2
]`.trim();
            const actual = runFormat("[ key1=/*foo*/value1, key2=value2 ]");
            compare(expected, actual);
        });

        it("[ // foo\\n key1=value1 ]", () => {
            const expected = `
[
    // foo
    key1 = value1
]`.trim();
            const actual = runFormat("[ // foo\n key1=value1 ]");
            compare(expected, actual);
        });

        it("[ // foo\\n // bar \\n key1=value1 ]", () => {
            const expected = `
[
    // foo
    // bar
    key1 = value1
]`.trim();
            const actual = runFormat("[ // foo\n // bar\n key1=value1 ]");
            compare(expected, actual);
        });

        it("[ /* foo */ // bar\\n key1=value1 ]", () => {
            const expected = `
[
    /* foo */
    // bar
    key1 = value1
]`.trim();
            const actual = runFormat("[ /* foo */ // bar\n key1=value1 ]");
            compare(expected, actual);
        });

        it("[ /* foo */ // bar\\n /* foobar */ key1=value1 ]", () => {
            const expected = `
[
    /* foo */
    // bar
    /* foobar */ key1 = value1
]`.trim();
            const actual = runFormat("[ /* foo */ // bar\n /* foobar */ key1=value1 ]");
            compare(expected, actual);
        });

        it("[ key1 = // foo\\n value1 ]", () => {
            const expected = `
[
    key1 =
        // foo
        value1
]`.trim();
            const actual = runFormat("[ key1 = // foo\n value1 ]");
            compare(expected, actual);
        });

        it("[ key1 // foo\\n = value1 ]", () => {
            const expected = `
[
    key1
    // foo
    = value1
]`.trim();
            const actual = runFormat("[ key1 // foo\n = value1 ]");
            compare(expected, actual);
        });

        it("section foobar; x = 1; // lineComment\n y = 1;", () => {
            const expected = `
section foobar;

x = 1;

// lineComment
y = 1;`.trim();
            const actual = runFormat("section foobar; x = 1; // lineComment\n y = 1;");
            compare(expected, actual);
        });
    });
});