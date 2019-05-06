import "mocha";
import { compare, runFormat } from "./common";

describe("basic serializer", () => {
    // ------------------------------------------
    // ---------- ArithmeticExpression ----------
    // ------------------------------------------
    describe("ArithmeticExpression", () => {
        it("1 + 2", () => {
            const expected = `1 + 2`;
            const actual = runFormat("1 + 2");
            compare(expected, actual);
        });

        it("1 + 2 + 3 + 4 + 5", () => {
            const expected = `
1
    + 2
    + 3
    + 4
    + 5`;
            const actual = runFormat("1 + 2 + 3 + 4 + 5");
            compare(expected, actual);
        });

        it("1 + foo(if true then 1 else 0) + bar (if true then 1 else 0)", () => {
            const expected = `
1
    + foo(
        if true then
            1
        else
            0
    )
    + bar(
        if true then
            1
        else
            0
    )`;
            const actual = runFormat("1 + foo(if true then 1 else 0) + bar (if true then 1 else 0)");
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- AsExpression ----------
    // ----------------------------------
    describe("AsExpression", () => {
        it("1 as number", () => {
            const expected = `1 as number`;
            const actual = runFormat("1 as number");
            compare(expected, actual);
        });
    })

    // ------------------------------------
    // ---------- EachExpression ----------
    // ------------------------------------
    describe("EachExpression", () => {
        it("each 1", () => {
            const expected = `each 1`;
            const actual = runFormat("each 1");
            compare(expected, actual);
        });

        it("each {1,2,3}", () => {
            const expected = `
each
    {
        1,
        2,
        3
    }`;
            const actual = runFormat("each {1,2,3}");
            compare(expected, actual);
        });

        it("each if true then 1 else 2", () => {
            const expected = `
each
    if true then
        1
    else
        2`;
            const actual = runFormat("each if true then 1 else 2");
            compare(expected, actual);
        });

        it("each each if true then 1 else 2", () => {
            const expected = `
each
    each
        if true then
            1
        else
            2`;
            const actual = runFormat("each each if true then 1 else 2");
            compare(expected, actual);
        });
    });

    // ---------------------------------------------
    // ---------- ErrorHandlingExpression ----------
    // ---------------------------------------------
    describe("ErrorHandlingExpression", () => {
        it("try 1", () => {
            const expected = `try 1`;
            const actual = runFormat("try 1");
            compare(expected, actual);
        });

        it("try 1 otherwise 1", () => {
            const expected = `try 1 otherwise 1`;
            const actual = runFormat("try 1 otherwise 1");
            compare(expected, actual);
        });

        it("try {1, 2}", () => {
            const expected = `
try
    {
        1,
        2
    }`;
            const actual = runFormat("try {1, 2}");
            compare(expected, actual);
        });

        it("try {1, 2} otherwise 1", () => {
            const expected = `
try
    {
        1,
        2
    }
otherwise 1`;
            const actual = runFormat("try {1, 2} otherwise 1");
            compare(expected, actual);
        });

        it("try 1 otherwise {1, 2}", () => {
            const expected = `
try 1
otherwise
    {
        1,
        2
    }`;
            const actual = runFormat("try 1 otherwise {1, 2}");
            compare(expected, actual);
        });
    });

    // --------------------------------------------
    // ---------- ErrorRaisingExpression ----------
    // --------------------------------------------
    describe("ErrorRaisingExpression", () => {
        it("error 1", () => {
            const expected = `error 1`;
            const actual = runFormat("error 1");
            compare(expected, actual);
        });

        it("error error 1", () => {
            const expected = `error error 1`;
            const actual = runFormat("error error 1");
            compare(expected, actual);
        });

        it("error {1,2}", () => {
            const expected = `
error {
    1,
    2
}`;
            const actual = runFormat("error {1,2}");
            compare(expected, actual);
        });

        it("error if fn(1,2,3) then 1 else 2", () => {
            const expected = `
error
    if fn(1, 2, 3) then
        1
    else
        2`;
            const actual = runFormat("error if fn(1,2,3) then 1 else 2");
            compare(expected, actual);
        });

        it("error {if true then 1 else 2}", () => {
            const expected = `
error {
    if true then
        1
    else
        2
}`;
            const actual = runFormat("error {if true then 1 else 2}");
            compare(expected, actual);
        });
    })

    // -----------------------------------
    // ---------- FieldProjection ----------
    // -----------------------------------
    describe("FieldProjection", () => {
        it("{}[[x]]", () => {
            const expected = `{}[[x]]`;
            const actual = runFormat("{}[[x]]");
            compare(expected, actual);
        });

        it("{}[[x]]?", () => {
            const expected = `{}[[x]]?`;
            const actual = runFormat("{}[[x]]?");
            compare(expected, actual);
        });

        it("{}[[x], [y]]", () => {
            const expected = `{}[[x], [y]]`;
            const actual = runFormat("{}[[x], [y]]");
            compare(expected, actual);
        });
    })

    // -----------------------------------
    // ---------- FieldSelector ----------
    // -----------------------------------
    describe("FieldSelector", () => {
        it("[x]", () => {
            const expected = `[x]`;
            const actual = runFormat("[x]");
            compare(expected, actual);
        });

        it("[x]?", () => {
            const expected = `[x]?`;
            const actual = runFormat("[x]?");
            compare(expected, actual);
        });
    })

    // ----------------------------------------
    // ---------- FunctionExpression ----------
    // ----------------------------------------
    describe("FunctionExpression", () => {
        it("() => 1", () => {
            const expected = `() => 1`;
            const actual = runFormat("() => 1");
            compare(expected, actual);
        });

        it("() as number => 1", () => {
            const expected = `() as number => 1`;
            const actual = runFormat("() as number => 1");
            compare(expected, actual);
        });

        it("(x) as number => 0", () => {
            const expected = `(x) as number => 0`;
            const actual = runFormat("(x) as number => 0");
            compare(expected, actual);
        });

        it("(x as number) as number => 0", () => {
            const expected = `(x as number) as number => 0`;
            const actual = runFormat("(x as number) as number => 0");
            compare(expected, actual);
        });

        it("(x as type) as number => 0", () => {
            const expected = `(x as type) as number => 0`;
            const actual = runFormat("(x as type) as number => 0");
            compare(expected, actual);
        });

        it("(optional x) => 0", () => {
            const expected = `(optional x) => 0`;
            const actual = runFormat("(optional x) => 0");
            compare(expected, actual);
        });

        it("(optional x as number) => 0", () => {
            const expected = `(optional x as number) => 0`;
            const actual = runFormat("(optional x as number) => 0");
            compare(expected, actual);
        });

        it("(optional x as nullable number) => 0", () => {
            const expected = `(optional x as nullable number) => 0`;
            const actual = runFormat("(optional x as nullable number) => 0");
            compare(expected, actual);
        });

        it("(x, y) => 0", () => {
            const expected = `(x, y) => 0`;
            const actual = runFormat("(x, y) => 0");
            compare(expected, actual);
        });

        it("(x, y as number) => 0", () => {
            const expected = `(x, y as number) => 0`;
            const actual = runFormat("(x, y as number) => 0");
            compare(expected, actual);
        });

        it("(x as number, y) => 0", () => {
            const expected = `(x as number, y) => 0`;
            const actual = runFormat("(x as number, y) => 0");
            compare(expected, actual);
        });

        it("() => {1,2,3}", () => {
            const expected = `
() =>
    {
        1,
        2,
        3
    }`;
            const actual = runFormat("() => {1,2,3}");
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- FunctionType ----------
    // ----------------------------------
    describe("FunctionType", () => {
        it("type function (foo as any) as any", () => {
            const expected = `type function (foo as any) as any`;
            const actual = runFormat("type function (foo as any) as any");
            compare(expected, actual);
        });

        it("type function (foo as any, bar as any) as any", () => {
            const expected = `type function (foo as any, bar as any) as any`;
            const actual = runFormat("type function (foo as any, bar as any) as any");
            compare(expected, actual);
        });

        it("type function (foo as any, optional bar as any) as any", () => {
            const expected = `type function (foo as any, optional bar as any) as any`;
            const actual = runFormat("type function (foo as any, optional bar as any) as any");
            compare(expected, actual);
        });
    })

    // -------------------------------------------
    // ---------- GeneralizedIdentifier ----------
    // -------------------------------------------

    describe("GeneralizedIdentifier", () => {
        it("[date]", () => {
            const expected = `[date]`;
            const actual = runFormat(`[date]`);
            compare(expected, actual);
        })

        it("[foo bar]", () => {
            const expected = `[foo bar]`;
            const actual = runFormat(`[foo bar]`);
            compare(expected, actual);
        })
    })

    // ----------------------------------
    // ---------- IfExpression ----------
    // ----------------------------------
    describe("IfExpression", () => {
        it("if true then true else false", () => {
            const expected = `
if true then
    true
else
    false`;
            const actual = runFormat("if true then true else false");
            compare(expected, actual);
        });

        it("if true then {1,2,3} else [key=value, cat=dog]", () => {
            const expected = `
if true then
    {
        1,
        2,
        3
    }
else
    [
        key = value,
        cat = dog
    ]`;
            const actual = runFormat("if true then {1,2,3} else [key=value, cat=dog]");
            compare(expected, actual);
        });

        it("if true then if true then true else false else false", () => {
            const expected = `
if true then
    if true then
        true
    else
        false
else
    false`;
            const actual = runFormat("if true then if true then true else false else false");
            compare(expected, actual);
        });

        it("if x then x else if x then x else x", () => {
            const expected = `
if x then
    x
else if x then
    x
else
    x`;
            const actual = runFormat("if x then x else if x then x else x");
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- IsExpression ----------
    // ----------------------------------
    describe("IsExpression", () => {
        it("1 is number", () => {
            const expected = `1 is number`;
            const actual = runFormat("1 is number");
            compare(expected, actual);
        });
    })

    // ------------------------------------------
    // ---------- ItemAccessExpression ----------
    // ------------------------------------------
    describe("ItemAccessExpression", () => {
        it("Foo{0}", () => {
            const expected = `Foo{0}`;
            const actual = runFormat("Foo{0}");
            compare(expected, actual);
        });

        it("Foo{[X = 1]}", () => {
            const expected = `Foo{[X = 1]}`;
            const actual = runFormat("Foo{[X = 1]}");
            compare(expected, actual);
        });

        it("Foo{[X = 1, Y = 2]}", () => {
            const expected = `
Foo{[
    X = 1,
    Y = 2
]}`;
            const actual = runFormat("Foo{[X = 1, Y = 2]}");
            compare(expected, actual);
        });

        it("Foo{if true then 1 else 2}", () => {
            const expected = `
Foo{
    if true then
        1
    else
        2
}`;
            const actual = runFormat("Foo{if true then 1 else 2}");
            compare(expected, actual);
        });
    });

    // --------------------------------------
    // ---------- InvokeExpression ----------
    // --------------------------------------
    describe("InvokeExpression", () => {
        it("Foo()", () => {
            const expected = `Foo()`;
            const actual = runFormat("Foo()");
            compare(expected, actual);
        });

        it("Foo(1)", () => {
            const expected = `Foo(1)`;
            const actual = runFormat("Foo(1)");
            compare(expected, actual);
        });

        it("Foo(let x = 1 in x)", () => {
            const expected = `
Foo(
    let
        x = 1
    in
        x
)`;
            const actual = runFormat("Foo(let x = 1 in x)");
            compare(expected, actual);
        });

        it("Foo(1, 2)", () => {
            const expected = `Foo(1, 2)`;
            const actual = runFormat("Foo(1, 2)");
            compare(expected, actual);
        });

        it("longLinearLength(123456789, 123456789, 123456789, 123456789)", () => {
            const expected = `
longLinearLength(
    123456789,
    123456789,
    123456789,
    123456789
)`;
            const actual = runFormat("longLinearLength(123456789, 123456789, 123456789, 123456789)");
            compare(expected, actual);
        });

        it("#datetimezone(2013, 02, 26, 09, 15, 00, 09, 00)", () => {
            const expected = `#datetimezone(2013, 02, 26, 09, 15, 00, 09, 00)`;
            const actual = runFormat("#datetimezone(2013, 02, 26, 09, 15, 00, 09, 00)");
            compare(expected, actual);
        });
    })

    // -----------------------------------
    // ---------- LetExpression ----------
    // -----------------------------------
    describe("LetExpression", () => {
        it("let x = 1 in x", () => {
            const expected = `
let
    x = 1
in
    x`
            const actual = runFormat("let x = 1 in x");
            compare(expected, actual);
        });

        it("let x = 1, y = 2 in let lst1 = {1,2}, lst2 = {} in {1,2,3}", () => {
            const expected = `
let
    x = 1,
    y = 2
in
    let
        lst1 = {
            1,
            2
        },
        lst2 = {}
    in
        {
            1,
            2,
            3
        }`;
            const actual = runFormat("let x = 1, y = 2 in let lst1 = {1,2}, lst2 = {} in {1,2,3}");
            compare(expected, actual);
        });
    });

    // ---------------------------------------
    // ---------- LiteralExpression ----------
    // ---------------------------------------
    describe(`LiteralExpression`, () => {
        it(`true`, () => {
            const expected = `true`
            const actual = runFormat(`true`);
            compare(expected, actual);
        });

        it(`false`, () => {
            const expected = `false`
            const actual = runFormat(`false`);
            compare(expected, actual);
        });

        it(`null`, () => {
            const expected = `null`
            const actual = runFormat(`null`);
            compare(expected, actual);
        });

        it(`1`, () => {
            const expected = `1`
            const actual = runFormat(`1`);
            compare(expected, actual);
        });

        it(`1.2`, () => {
            const expected = `1.2`
            const actual = runFormat(`1.2`);
            compare(expected, actual);
        });

        it(`1.2e1`, () => {
            const expected = `1.2e1`
            const actual = runFormat(`1.2e1`);
            compare(expected, actual);
        });

        it(`.1`, () => {
            const expected = `.1`
            const actual = runFormat(`.1`);
            compare(expected, actual);
        });

        it(`0.1e1`, () => {
            const expected = `0.1e1`
            const actual = runFormat(`0.1e1`);
            compare(expected, actual);
        });

        it(`0x1`, () => {
            const expected = `0x1`
            const actual = runFormat(`0x1`);
            compare(expected, actual);
        });

        it(`0X1`, () => {
            const expected = `0X1`
            const actual = runFormat(`0X1`);
            compare(expected, actual);
        });
    })

    // ------------------------------------
    // ---------- ListExpression ----------
    // ------------------------------------
    describe("ListExpression", () => {
        it("{}", () => {
            const expected = "{}";
            const actual = runFormat("{}");
            compare(expected, actual);
        });

        it("{1}", () => {
            const expected = "{1}";
            const actual = runFormat("{1}");
            compare(expected, actual);
        });

        it("{1,2}", () => {
            const expected = `
{
    1,
    2
}`;
            const actual = runFormat("{1,2}");
            compare(expected, actual);
        });

        it("{{}, {}}", () => {
            const expected = `
{
    {},
    {}
}`;
            const actual = runFormat("{{}, {}}");
            compare(expected, actual);
        });

        it("(x) => {x}", () => {
            const expected = `(x) => {x}`;
            const actual = runFormat("(x) => {x}");
            compare(expected, actual);
        });

        it("let x = Foo(1, {2}) in x", () => {
            const expected = `
let
    x = Foo(1, {2})
in
    x`;
            const actual = runFormat("let x = Foo(1, {2}) in x");
            compare(expected, actual);
        });
    });

    // ------------------------------
    // ---------- ListType ----------
    // ------------------------------
    describe("ListType", () => {
        it("type {any}", () => {
            const expected = "type {any}";
            const actual = runFormat("type {any}");
            compare(expected, actual);
        });

        it("type { table [ foo, bar ] }", () => {
            const expected = `
type {
    table [
        foo,
        bar
    ]
}`;
            const actual = runFormat("type { table [ foo, bar ] }");
            compare(expected, actual);
        });
    })

    // ----------------------------------
    // ---------- NullableType ----------
    // ----------------------------------
    describe("NullableType", () => {
        it("type nullable any", () => {
            const expected = "type nullable any";
            const actual = runFormat("type nullable any");
            compare(expected, actual);
        });

        it("type nullable table [foo]", () => {
            const expected = "type nullable table [foo]";
            const actual = runFormat("type nullable table [foo]");
            compare(expected, actual);
        });

        it("type nullable table [foo, bar]", () => {
            const expected = `
type nullable
    table [
        foo,
        bar
    ]`;
            const actual = runFormat("type nullable table [foo, bar]");
            compare(expected, actual);
        });
    })

    // ---------------------------------------------
    // ---------- ParenthesizedExpression ----------
    // ---------------------------------------------
    describe("ParenthesizedExpression", () => {
        it("(1)", () => {
            const expected = "(1)";
            const actual = runFormat("(1)");
            compare(expected, actual);
        });

        it("({1,2})", () => {
            const expected = `
(
    {
        1,
        2
    }
)
`;
            const actual = runFormat("({1,2})");
            compare(expected, actual);
        });
    })

    // -----------------------------------
    // ---------- PrimitiveType ----------
    // -----------------------------------
    describe("PrimitiveType", () => {
        it("type any", () => {
            const expected = "type any";
            const actual = runFormat("type any");
            compare(expected, actual);
        });

        it("type null", () => {
            const expected = "type null";
            const actual = runFormat("type null");
            compare(expected, actual);
        });
    });

    // --------------------------------------
    // ---------- RecordExpression ----------
    // --------------------------------------
    describe("RecordExpression", () => {
        it("[]", () => {
            const expected = "[]";
            const actual = runFormat("[]");
            compare(expected, actual);
        });

        it("[a=a]", () => {
            const expected = "[a = a]";
            const actual = runFormat("[a=a]");
            compare(expected, actual);
        });

        it("[a=a,b=b]", () => {
            const expected = `
[
    a = a,
    b = b
]`;
            const actual = runFormat("[a=a,b=b]");
            compare(expected, actual);
        });

        it("[a={},b={}]", () => {
            const expected = `
[
    a = {},
    b = {}
]
`;
            const actual = runFormat("[a={},b={}]");
            compare(expected, actual);
        });

        it("[a={1},b={2}]", () => {
            const expected = `
[
    a = {
        1
    },
    b = {
        2
    }
]`;
            const actual = runFormat("[a={1},b={2}]");
            compare(expected, actual);
        });

        it("(x) => [x=x]", () => {
            const expected = `(x) => [x = x]`;
            const actual = runFormat("(x) => [x = x]");
            compare(expected, actual);
        });

        it("let x = Foo(1, [key = value]) in x", () => {
            const expected = `
let
    x = Foo(1, [key = value])
in
    x`;
            const actual = runFormat("let x = Foo(1, [key = value]) in x");
            compare(expected, actual);
        });
    });

    // --------------------------------
    // ---------- RecordType ----------
    // --------------------------------
    describe("RecordType", () => {
        it("type [...]", () => {
            const expected = "type [...]";
            const actual = runFormat("type [...]");
            compare(expected, actual);
        });

        it("type [foo]", () => {
            const expected = "type [foo]";
            const actual = runFormat("type [foo]");
            compare(expected, actual);
        });

        it("type [foo, ...]", () => {
            const expected = `
type [
    foo,
    ...
]
`;
            const actual = runFormat("type [foo, ...]");
            compare(expected, actual);
        });
    })

    // -------------------------------
    // ---------- TableType ----------
    // -------------------------------
    describe("TableType", () => {
        it("type table foo", () => {
            const expected = "type table foo";
            const actual = runFormat("type table foo");
            compare(expected, actual);
        });

        it("type table [foo]", () => {
            const expected = "type table [foo]";
            const actual = runFormat("type table [foo]");
            compare(expected, actual);
        });

        it("type table [optional foo]", () => {
            const expected = "type table [optional foo]";
            const actual = runFormat("type table [optional foo]");
            compare(expected, actual);
        });

        it("type table [ foo, bar ]", () => {
            const expected = `
type table [
    foo,
    bar
]
`;
            const actual = runFormat("type table [ foo, bar ]");
            compare(expected, actual);
        });

        it("type table [ foo, optional bar ]", () => {
            const expected = `
type table [
    foo,
    optional bar
]
`;
            const actual = runFormat("type table [ foo, optional bar ]");
            compare(expected, actual);
        });

        it("type table [ foo = number ]", () => {
            const expected = `type table [foo = number]`;
            const actual = runFormat("type table [foo = number]");
            compare(expected, actual);
        });

        it("type table [foo = table [key]]", () => {
            const expected = `type table [foo = table [key]]`;
            const actual = runFormat("type table [foo = table [key]]");
            compare(expected, actual);
        });

        it("type table [foo = table [key], bar, optional foobar = number]", () => {
            const expected = `
type table [
    foo = table [key],
    bar,
    optional foobar = number
]`;
            const actual = runFormat("type table [foo = table [key], bar, optional foobar = number]");
            compare(expected, actual);
        });
    })

    // --------------------------------------
    // ---------- TBinOpExpression ----------
    // --------------------------------------
    describe("TBinOpExpression", () => {
        // chained TBinOpExpressions are multiline after X expressions
        // and should count all expressions, not just (1 + node.rest.length) on like NodeKind.
        it("1 + 2 + 3 and 4", () => {
            const expected = `
1
    + 2
    + 3
    and 4`;
            const actual = runFormat("1 + 2 + 3 and 4");
            compare(expected, actual);
        });

        it("true or false and true or true", () => {
            const expected = `
true
    or false
    and true
    or true`;
            const actual = runFormat("true or false and true or true");
            compare(expected, actual);
        });

        it("a = true and b = true and c = true", () => {
            const expected = `
a = true
    and b = true
    and c = true`;
            const actual = runFormat("a = true and b = true and c = true");
            compare(expected, actual);
        });
    })

    // -----------------------------------
    // ---------- TBinOpKeyword ----------
    // -----------------------------------
    describe("TBinOpKeyword", () => {
        it("1 as number", () => {
            const expected = "1 as number";
            const actual = runFormat("1 as number");
            compare(expected, actual);
        });

        it("1 as nullable number", () => {
            const expected = "1 as nullable number";
            const actual = runFormat("1 as nullable number");
            compare(expected, actual);
        });

        it("1 meta (if 1 then 2 else 3)", () => {
            const expected = `
1
meta
(
    if 1 then
        2
    else
        3
)`;
            const actual = runFormat("1 meta (if 1 then 2 else 3)");
            compare(expected, actual);
        });

        it("{1, 2} as list", () => {
            const expected = `
{
    1,
    2
}
as
list`;
            const actual = runFormat("{1, 2} as list");
            compare(expected, actual);
        });

        it("{1, 2} meta (if 1 then 2 else 3)", () => {
            const expected = `
{
    1,
    2
}
meta
(
    if 1 then
        2
    else
        3
)`;
            const actual = runFormat("{1, 2} meta (if 1 then 2 else 3)");
            compare(expected, actual);
        });
    });

    // --------------------------
    // ---------- Type ----------
    // --------------------------
    describe("Type", () => {
        // check that readType is parsing invoke-expressions
        it("type table [ Foo = X(), Bar = Y() ]", () => {
            const expected = `
type table [
    Foo = X(),
    Bar = Y()
]`;
            const actual = runFormat("type table [ Foo = X(), Bar = Y() ]");
            compare(expected, actual);
        });

        // check that readType is parsing invoke-expressions
        it("type table [Date accessed = datetimezone]", () => {
            const expected = `type table [Date accessed = datetimezone]`;
            const actual = runFormat("type table [Date accessed=datetimezone]");
            compare(expected, actual);
        });
    })

    // --------------------------------------
    // ---------- UnaryExpression ----------
    // --------------------------------------
    describe("UnaryExpression", () => {
        it("-1", () => {
            const expected = "-1";
            const actual = runFormat("-1");
            compare(expected, actual);
        });

        it("--1", () => {
            const expected = "--1";
            const actual = runFormat("--1");
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- mixed nesting ----------
    // -----------------------------------
    describe("mixed nesting", () => {
        it("[foo={},bar={}]", () => {
            const expected = `
[
    foo = {},
    bar = {}
]`;
            const actual = runFormat("[foo={},bar={}]");
            compare(expected, actual);
        });

        it("[first=[insideKey=insideValue,lst={1,2,3},emptyLst={}]]", () => {
            const expected = `
[
    first = [
        insideKey = insideValue,
        lst = {
            1,
            2,
            3
        },
        emptyLst = {}
    ]
]`;
            const actual = runFormat("[first=[insideKey=insideValue,lst={1,2,3},emptyLst={}]]");
            compare(expected, actual);
        });
    });
});