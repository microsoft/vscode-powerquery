import "mocha";
import { compare, runFormat } from "./common";

describe(`basic serializer`, () => {
    // ------------------------------------------
    // ---------- ArithmeticExpression ----------
    // ------------------------------------------
    describe(`ArithmeticExpression`, () => {
        it(`1 + 2`, () => {
            const expected: string = `1 + 2`;
            const actual: string = runFormat(`1 + 2`);
            compare(expected, actual);
        });

        it(`1 + 2 + 3 + 4 + 5`, () => {
            const expected: string = `
1
    + 2
    + 3
    + 4
    + 5`;
            const actual: string = runFormat(`1 + 2 + 3 + 4 + 5`);
            compare(expected, actual);
        });

        it(`1 + foo(if true then 1 else 0) + bar (if true then 1 else 0)`, () => {
            const expected: string = `
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
            const actual: string = runFormat(`1 + foo(if true then 1 else 0) + bar (if true then 1 else 0)`);
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- AsExpression ----------
    // ----------------------------------
    describe(`AsExpression`, () => {
        it(`1 as number`, () => {
            const expected: string = `1 as number`;
            const actual: string = runFormat(`1 as number`);
            compare(expected, actual);
        });
    });

    // ------------------------------------
    // ---------- EachExpression ----------
    // ------------------------------------
    describe(`EachExpression`, () => {
        it(`each 1`, () => {
            const expected: string = `each 1`;
            const actual: string = runFormat(`each 1`);
            compare(expected, actual);
        });

        it(`each {1,2,3}`, () => {
            const expected: string = `
each
    {
        1,
        2,
        3
    }`;
            const actual: string = runFormat(`each {1,2,3}`);
            compare(expected, actual);
        });

        it(`each if true then 1 else 2`, () => {
            const expected: string = `
each
    if true then
        1
    else
        2`;
            const actual: string = runFormat(`each if true then 1 else 2`);
            compare(expected, actual);
        });

        it(`each each if true then 1 else 2`, () => {
            const expected: string = `
each
    each
        if true then
            1
        else
            2`;
            const actual: string = runFormat(`each each if true then 1 else 2`);
            compare(expected, actual);
        });
    });

    // ---------------------------------------------
    // ---------- ErrorHandlingExpression ----------
    // ---------------------------------------------
    describe(`ErrorHandlingExpression`, () => {
        it(`try 1`, () => {
            const expected: string = `try 1`;
            const actual: string = runFormat(`try 1`);
            compare(expected, actual);
        });

        it(`try 1 otherwise 1`, () => {
            const expected: string = `try 1 otherwise 1`;
            const actual: string = runFormat(`try 1 otherwise 1`);
            compare(expected, actual);
        });

        it(`try {1, 2}`, () => {
            const expected: string = `
try
    {
        1,
        2
    }`;
            const actual: string = runFormat(`try {1, 2}`);
            compare(expected, actual);
        });

        it(`try {1, 2} otherwise 1`, () => {
            const expected: string = `
try
    {
        1,
        2
    }
otherwise 1`;
            const actual: string = runFormat(`try {1, 2} otherwise 1`);
            compare(expected, actual);
        });

        it(`try 1 otherwise {1, 2}`, () => {
            const expected: string = `
try 1
otherwise
    {
        1,
        2
    }`;
            const actual: string = runFormat(`try 1 otherwise {1, 2}`);
            compare(expected, actual);
        });
    });

    // --------------------------------------------
    // ---------- ErrorRaisingExpression ----------
    // --------------------------------------------
    describe(`ErrorRaisingExpression`, () => {
        it(`error 1`, () => {
            const expected: string = `error 1`;
            const actual: string = runFormat(`error 1`);
            compare(expected, actual);
        });

        it(`error error 1`, () => {
            const expected: string = `error error 1`;
            const actual: string = runFormat(`error error 1`);
            compare(expected, actual);
        });

        it(`error {1,2}`, () => {
            const expected: string = `
error {
    1,
    2
}`;
            const actual: string = runFormat(`error {1,2}`);
            compare(expected, actual);
        });

        it(`error if fn(1,2,3) then 1 else 2`, () => {
            const expected: string = `
error
    if fn(1, 2, 3) then
        1
    else
        2`;
            const actual: string = runFormat(`error if fn(1,2,3) then 1 else 2`);
            compare(expected, actual);
        });

        it(`error {if true then 1 else 2}`, () => {
            const expected: string = `
error {
    if true then
        1
    else
        2
}`;
            const actual: string = runFormat(`error {if true then 1 else 2}`);
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- FieldProjection ----------
    // -----------------------------------
    describe(`FieldProjection`, () => {
        it(`{}[[x]]`, () => {
            const expected: string = `{}[[x]]`;
            const actual: string = runFormat(`{}[[x]]`);
            compare(expected, actual);
        });

        it(`{}[[x]]?`, () => {
            const expected: string = `{}[[x]]?`;
            const actual: string = runFormat(`{}[[x]]?`);
            compare(expected, actual);
        });

        it(`{}[[x], [y]]`, () => {
            const expected: string = `{}[[x], [y]]`;
            const actual: string = runFormat(`{}[[x], [y]]`);
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- FieldSelector ----------
    // -----------------------------------
    describe(`FieldSelector`, () => {
        it(`[x]`, () => {
            const expected: string = `[x]`;
            const actual: string = runFormat(`[x]`);
            compare(expected, actual);
        });

        it(`[x]?`, () => {
            const expected: string = `[x]?`;
            const actual: string = runFormat(`[x]?`);
            compare(expected, actual);
        });
    });

    // ----------------------------------------
    // ---------- FunctionExpression ----------
    // ----------------------------------------
    describe(`FunctionExpression`, () => {
        it(`() => 1`, () => {
            const expected: string = `() => 1`;
            const actual: string = runFormat(`() => 1`);
            compare(expected, actual);
        });

        it(`() as number => 1`, () => {
            const expected: string = `() as number => 1`;
            const actual: string = runFormat(`() as number => 1`);
            compare(expected, actual);
        });

        it(`(x) as number => 0`, () => {
            const expected: string = `(x) as number => 0`;
            const actual: string = runFormat(`(x) as number => 0`);
            compare(expected, actual);
        });

        it(`(x as number) as number => 0`, () => {
            const expected: string = `(x as number) as number => 0`;
            const actual: string = runFormat(`(x as number) as number => 0`);
            compare(expected, actual);
        });

        it(`(x as type) as number => 0`, () => {
            const expected: string = `(x as type) as number => 0`;
            const actual: string = runFormat(`(x as type) as number => 0`);
            compare(expected, actual);
        });

        it(`(optional x) => 0`, () => {
            const expected: string = `(optional x) => 0`;
            const actual: string = runFormat(`(optional x) => 0`);
            compare(expected, actual);
        });

        it(`(optional x as number) => 0`, () => {
            const expected: string = `(optional x as number) => 0`;
            const actual: string = runFormat(`(optional x as number) => 0`);
            compare(expected, actual);
        });

        it(`(optional x as nullable number) => 0`, () => {
            const expected: string = `(optional x as nullable number) => 0`;
            const actual: string = runFormat(`(optional x as nullable number) => 0`);
            compare(expected, actual);
        });

        it(`(x, y) => 0`, () => {
            const expected: string = `(x, y) => 0`;
            const actual: string = runFormat(`(x, y) => 0`);
            compare(expected, actual);
        });

        it(`(x, y as number) => 0`, () => {
            const expected: string = `(x, y as number) => 0`;
            const actual: string = runFormat(`(x, y as number) => 0`);
            compare(expected, actual);
        });

        it(`(x as number, y) => 0`, () => {
            const expected: string = `(x as number, y) => 0`;
            const actual: string = runFormat(`(x as number, y) => 0`);
            compare(expected, actual);
        });

        it(`() => {1,2,3}`, () => {
            const expected: string = `
() =>
    {
        1,
        2,
        3
    }`;
            const actual: string = runFormat(`() => {1,2,3}`);
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- FunctionType ----------
    // ----------------------------------
    describe(`FunctionType`, () => {
        it(`type function (foo as any) as any`, () => {
            const expected: string = `type function (foo as any) as any`;
            const actual: string = runFormat(`type function (foo as any) as any`);
            compare(expected, actual);
        });

        it(`type function (foo as any, bar as any) as any`, () => {
            const expected: string = `type function (foo as any, bar as any) as any`;
            const actual: string = runFormat(`type function (foo as any, bar as any) as any`);
            compare(expected, actual);
        });

        it(`type function (foo as any, optional bar as any) as any`, () => {
            const expected: string = `type function (foo as any, optional bar as any) as any`;
            const actual: string = runFormat(`type function (foo as any, optional bar as any) as any`);
            compare(expected, actual);
        });
    });

    // -------------------------------------------
    // ---------- GeneralizedIdentifier ----------
    // -------------------------------------------

    describe(`GeneralizedIdentifier`, () => {
        it(`[date]`, () => {
            const expected: string = `[date]`;
            const actual: string = runFormat(`[date]`);
            compare(expected, actual);
        });

        it(`[foo bar]`, () => {
            const expected: string = `[foo bar]`;
            const actual: string = runFormat(`[foo bar]`);
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- IfExpression ----------
    // ----------------------------------
    describe(`IfExpression`, () => {
        it(`if true then true else false`, () => {
            const expected: string = `
if true then
    true
else
    false`;
            const actual: string = runFormat(`if true then true else false`);
            compare(expected, actual);
        });

        it(`if true then {1,2,3} else [key=value, cat=dog]`, () => {
            const expected: string = `
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
            const actual: string = runFormat(`if true then {1,2,3} else [key=value, cat=dog]`);
            compare(expected, actual);
        });

        it(`if true then if true then true else false else false`, () => {
            const expected: string = `
if true then
    if true then
        true
    else
        false
else
    false`;
            const actual: string = runFormat(`if true then if true then true else false else false`);
            compare(expected, actual);
        });

        it(`if x then x else if x then x else x`, () => {
            const expected: string = `
if x then
    x
else if x then
    x
else
    x`;
            const actual: string = runFormat(`if x then x else if x then x else x`);
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- IsExpression ----------
    // ----------------------------------
    describe(`IsExpression`, () => {
        it(`1 is number`, () => {
            const expected: string = `1 is number`;
            const actual: string = runFormat(`1 is number`);
            compare(expected, actual);
        });
    });

    // ------------------------------------------
    // ---------- ItemAccessExpression ----------
    // ------------------------------------------
    describe(`ItemAccessExpression`, () => {
        it(`Foo{0}`, () => {
            const expected: string = `Foo{0}`;
            const actual: string = runFormat(`Foo{0}`);
            compare(expected, actual);
        });

        it(`Foo{[X = 1]}`, () => {
            const expected: string = `Foo{[X = 1]}`;
            const actual: string = runFormat(`Foo{[X = 1]}`);
            compare(expected, actual);
        });

        it(`Foo{[X = 1, Y = 2]}`, () => {
            const expected: string = `
Foo{[
    X = 1,
    Y = 2
]}`;
            const actual: string = runFormat(`Foo{[X = 1, Y = 2]}`);
            compare(expected, actual);
        });

        it(`Foo{if true then 1 else 2}`, () => {
            const expected: string = `
Foo{
    if true then
        1
    else
        2
}`;
            const actual: string = runFormat(`Foo{if true then 1 else 2}`);
            compare(expected, actual);
        });
    });

    // --------------------------------------
    // ---------- InvokeExpression ----------
    // --------------------------------------
    describe(`InvokeExpression`, () => {
        it(`Foo()`, () => {
            const expected: string = `Foo()`;
            const actual: string = runFormat(`Foo()`);
            compare(expected, actual);
        });

        it(`Foo(1)`, () => {
            const expected: string = `Foo(1)`;
            const actual: string = runFormat(`Foo(1)`);
            compare(expected, actual);
        });

        it(`Foo(let x = 1 in x)`, () => {
            const expected: string = `
Foo(
    let
        x = 1
    in
        x
)`;
            const actual: string = runFormat(`Foo(let x = 1 in x)`);
            compare(expected, actual);
        });

        it(`Foo(1, 2)`, () => {
            const expected: string = `Foo(1, 2)`;
            const actual: string = runFormat(`Foo(1, 2)`);
            compare(expected, actual);
        });

        it(`longLinearLength(123456789, 123456789, 123456789, 123456789)`, () => {
            const expected: string = `
longLinearLength(
    123456789,
    123456789,
    123456789,
    123456789
)`;
            const actual: string = runFormat(`longLinearLength(123456789, 123456789, 123456789, 123456789)`);
            compare(expected, actual);
        });

        it(`#datetimezone(2013, 02, 26, 09, 15, 00, 09, 00)`, () => {
            const expected: string = `#datetimezone(2013, 02, 26, 09, 15, 00, 09, 00)`;
            const actual: string = runFormat(`#datetimezone(2013, 02, 26, 09, 15, 00, 09, 00)`);
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- LetExpression ----------
    // -----------------------------------
    describe(`LetExpression`, () => {
        it(`let x = 1 in x`, () => {
            const expected: string = `
let
    x = 1
in
    x`;
            const actual: string = runFormat(`let x = 1 in x`);
            compare(expected, actual);
        });

        it(`let x = 1, y = 2 in let lst1 = {1,2}, lst2 = {} in {1,2,3}`, () => {
            const expected: string = `
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
            const actual: string = runFormat(`let x = 1, y = 2 in let lst1 = {1,2}, lst2 = {} in {1,2,3}`);
            compare(expected, actual);
        });
    });

    // ---------------------------------------
    // ---------- LiteralExpression ----------
    // ---------------------------------------
    describe(`LiteralExpression`, () => {
        it(`true`, () => {
            const expected: string = `true`;
            const actual: string = runFormat(`true`);
            compare(expected, actual);
        });

        it(`false`, () => {
            const expected: string = `false`;
            const actual: string = runFormat(`false`);
            compare(expected, actual);
        });

        it(`null`, () => {
            const expected: string = `null`;
            const actual: string = runFormat(`null`);
            compare(expected, actual);
        });

        it(`1`, () => {
            const expected: string = `1`;
            const actual: string = runFormat(`1`);
            compare(expected, actual);
        });

        it(`1.2`, () => {
            const expected: string = `1.2`;
            const actual: string = runFormat(`1.2`);
            compare(expected, actual);
        });

        it(`1.2e1`, () => {
            const expected: string = `1.2e1`;
            const actual: string = runFormat(`1.2e1`);
            compare(expected, actual);
        });

        it(`.1`, () => {
            const expected: string = `.1`;
            const actual: string = runFormat(`.1`);
            compare(expected, actual);
        });

        it(`0.1e1`, () => {
            const expected: string = `0.1e1`;
            const actual: string = runFormat(`0.1e1`);
            compare(expected, actual);
        });

        it(`0x1`, () => {
            const expected: string = `0x1`;
            const actual: string = runFormat(`0x1`);
            compare(expected, actual);
        });

        it(`0X1`, () => {
            const expected: string = `0X1`;
            const actual: string = runFormat(`0X1`);
            compare(expected, actual);
        });
    });

    // ------------------------------------
    // ---------- ListExpression ----------
    // ------------------------------------
    describe(`ListExpression`, () => {
        it(`{}`, () => {
            const expected: string = `{}`;
            const actual: string = runFormat(`{}`);
            compare(expected, actual);
        });

        it(`{1}`, () => {
            const expected: string = `{1}`;
            const actual: string = runFormat(`{1}`);
            compare(expected, actual);
        });

        it(`{1,2}`, () => {
            const expected: string = `
{
    1,
    2
}`;
            const actual: string = runFormat(`{1,2}`);
            compare(expected, actual);
        });

        it(`{{}, {}}`, () => {
            const expected: string = `
{
    {},
    {}
}`;
            const actual: string = runFormat(`{{}, {}}`);
            compare(expected, actual);
        });

        it(`(x) => {x}`, () => {
            const expected: string = `(x) => {x}`;
            const actual: string = runFormat(`(x) => {x}`);
            compare(expected, actual);
        });

        it(`let x = Foo(1, {2}) in x`, () => {
            const expected: string = `
let
    x = Foo(1, {2})
in
    x`;
            const actual: string = runFormat(`let x = Foo(1, {2}) in x`);
            compare(expected, actual);
        });
    });

    // ------------------------------
    // ---------- ListType ----------
    // ------------------------------
    describe(`ListType`, () => {
        it(`type {any}`, () => {
            const expected: string = `type {any}`;
            const actual: string = runFormat(`type {any}`);
            compare(expected, actual);
        });

        it(`type { table [ foo, bar ] }`, () => {
            const expected: string = `
type {
    table [
        foo,
        bar
    ]
}`;
            const actual: string = runFormat(`type { table [ foo, bar ] }`);
            compare(expected, actual);
        });
    });

    // ----------------------------------
    // ---------- NullableType ----------
    // ----------------------------------
    describe(`NullableType`, () => {
        it(`type nullable any`, () => {
            const expected: string = `type nullable any`;
            const actual: string = runFormat(`type nullable any`);
            compare(expected, actual);
        });

        it(`type nullable table [foo]`, () => {
            const expected: string = `type nullable table [foo]`;
            const actual: string = runFormat(`type nullable table [foo]`);
            compare(expected, actual);
        });

        it(`type nullable table [foo, bar]`, () => {
            const expected: string = `
type nullable
    table [
        foo,
        bar
    ]`;
            const actual: string = runFormat(`type nullable table [foo, bar]`);
            compare(expected, actual);
        });
    });

    // ---------------------------------------------
    // ---------- ParenthesizedExpression ----------
    // ---------------------------------------------
    describe(`ParenthesizedExpression`, () => {
        it(`(1)`, () => {
            const expected: string = `(1)`;
            const actual: string = runFormat(`(1)`);
            compare(expected, actual);
        });

        it(`({1,2})`, () => {
            const expected: string = `
(
    {
        1,
        2
    }
)
`;
            const actual: string = runFormat(`({1,2})`);
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- PrimitiveType ----------
    // -----------------------------------
    describe(`PrimitiveType`, () => {
        it(`type any`, () => {
            const expected: string = `type any`;
            const actual: string = runFormat(`type any`);
            compare(expected, actual);
        });

        it(`type null`, () => {
            const expected: string = `type null`;
            const actual: string = runFormat(`type null`);
            compare(expected, actual);
        });
    });

    // --------------------------------------
    // ---------- RecordExpression ----------
    // --------------------------------------
    describe(`RecordExpression`, () => {
        it(`[]`, () => {
            const expected: string = `[]`;
            const actual: string = runFormat(`[]`);
            compare(expected, actual);
        });

        it(`[a=a]`, () => {
            const expected: string = `[a = a]`;
            const actual: string = runFormat(`[a=a]`);
            compare(expected, actual);
        });

        it(`[a=a,b=b]`, () => {
            const expected: string = `
[
    a = a,
    b = b
]`;
            const actual: string = runFormat(`[a=a,b=b]`);
            compare(expected, actual);
        });

        it(`[a={},b={}]`, () => {
            const expected: string = `
[
    a = {},
    b = {}
]
`;
            const actual: string = runFormat(`[a={},b={}]`);
            compare(expected, actual);
        });

        it(`[a={1},b={2}]`, () => {
            const expected: string = `
[
    a = {
        1
    },
    b = {
        2
    }
]`;
            const actual: string = runFormat(`[a={1},b={2}]`);
            compare(expected, actual);
        });

        it(`(x) => [x=x]`, () => {
            const expected: string = `(x) => [x = x]`;
            const actual: string = runFormat(`(x) => [x = x]`);
            compare(expected, actual);
        });

        it(`let x = Foo(1, [key = value]) in x`, () => {
            const expected: string = `
let
    x = Foo(1, [key = value])
in
    x`;
            const actual: string = runFormat(`let x = Foo(1, [key = value]) in x`);
            compare(expected, actual);
        });
    });

    // --------------------------------
    // ---------- RecordType ----------
    // --------------------------------
    describe(`RecordType`, () => {
        it(`type [...]`, () => {
            const expected: string = `type [...]`;
            const actual: string = runFormat(`type [...]`);
            compare(expected, actual);
        });

        it(`type [foo]`, () => {
            const expected: string = `type [foo]`;
            const actual: string = runFormat(`type [foo]`);
            compare(expected, actual);
        });

        it(`type [foo, ...]`, () => {
            const expected: string = `
type [
    foo,
    ...
]
`;
            const actual: string = runFormat(`type [foo, ...]`);
            compare(expected, actual);
        });
    });

    // -------------------------------
    // ---------- TableType ----------
    // -------------------------------
    describe(`TableType`, () => {
        it(`type table foo`, () => {
            const expected: string = `type table foo`;
            const actual: string = runFormat(`type table foo`);
            compare(expected, actual);
        });

        it(`type table [foo]`, () => {
            const expected: string = `type table [foo]`;
            const actual: string = runFormat(`type table [foo]`);
            compare(expected, actual);
        });

        it(`type table [optional foo]`, () => {
            const expected: string = `type table [optional foo]`;
            const actual: string = runFormat(`type table [optional foo]`);
            compare(expected, actual);
        });

        it(`type table [ foo, bar ]`, () => {
            const expected: string = `
type table [
    foo,
    bar
]
`;
            const actual: string = runFormat(`type table [ foo, bar ]`);
            compare(expected, actual);
        });

        it(`type table [ foo, optional bar ]`, () => {
            const expected: string = `
type table [
    foo,
    optional bar
]
`;
            const actual: string = runFormat(`type table [ foo, optional bar ]`);
            compare(expected, actual);
        });

        it(`type table [ foo = number ]`, () => {
            const expected: string = `type table [foo = number]`;
            const actual: string = runFormat(`type table [foo = number]`);
            compare(expected, actual);
        });

        it(`type table [foo = table [key]]`, () => {
            const expected: string = `type table [foo = table [key]]`;
            const actual: string = runFormat(`type table [foo = table [key]]`);
            compare(expected, actual);
        });

        it(`type table [foo = table [key], bar, optional foobar = number]`, () => {
            const expected: string = `
type table [
    foo = table [key],
    bar,
    optional foobar = number
]`;
            const actual: string = runFormat(`type table [foo = table [key], bar, optional foobar = number]`);
            compare(expected, actual);
        });
    });

    // --------------------------------------
    // ---------- TBinOpExpression ----------
    // --------------------------------------
    describe(`TBinOpExpression`, () => {
        // chained TBinOpExpressions are multiline after X expressions
        // and should count all expressions, not just (1 + node.rest.length) on like NodeKind.
        it(`1 + 2 + 3 and 4`, () => {
            const expected: string = `
1
    + 2
    + 3
    and 4`;
            const actual: string = runFormat(`1 + 2 + 3 and 4`);
            compare(expected, actual);
        });

        it(`true or false and true or true`, () => {
            const expected: string = `
true
    or false
    and true
    or true`;
            const actual: string = runFormat(`true or false and true or true`);
            compare(expected, actual);
        });

        it(`a = true and b = true and c = true`, () => {
            const expected: string = `
a = true
    and b = true
    and c = true`;
            const actual: string = runFormat(`a = true and b = true and c = true`);
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- TBinOpKeyword ----------
    // -----------------------------------
    describe(`TBinOpKeyword`, () => {
        it(`1 as number`, () => {
            const expected: string = `1 as number`;
            const actual: string = runFormat(`1 as number`);
            compare(expected, actual);
        });

        it(`1 as nullable number`, () => {
            const expected: string = `1 as nullable number`;
            const actual: string = runFormat(`1 as nullable number`);
            compare(expected, actual);
        });

        it(`1 meta (if 1 then 2 else 3)`, () => {
            const expected: string = `
1
meta
(
    if 1 then
        2
    else
        3
)`;
            const actual: string = runFormat(`1 meta (if 1 then 2 else 3)`);
            compare(expected, actual);
        });

        it(`{1, 2} as list`, () => {
            const expected: string = `
{
    1,
    2
}
as
list`;
            const actual: string = runFormat(`{1, 2} as list`);
            compare(expected, actual);
        });

        it(`{1, 2} meta (if 1 then 2 else 3)`, () => {
            const expected: string = `
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
            const actual: string = runFormat(`{1, 2} meta (if 1 then 2 else 3)`);
            compare(expected, actual);
        });
    });

    // --------------------------
    // ---------- Type ----------
    // --------------------------
    describe(`Type`, () => {
        // check that readType is parsing invoke-expressions
        it(`type table [ Foo = X(), Bar = Y() ]`, () => {
            const expected: string = `
type table [
    Foo = X(),
    Bar = Y()
]`;
            const actual: string = runFormat(`type table [ Foo = X(), Bar = Y() ]`);
            compare(expected, actual);
        });

        // check that readType is parsing invoke-expressions
        it(`type table [Date accessed = datetimezone]`, () => {
            const expected: string = `type table [Date accessed = datetimezone]`;
            const actual: string = runFormat(`type table [Date accessed=datetimezone]`);
            compare(expected, actual);
        });
    });

    // --------------------------------------
    // ---------- UnaryExpression ----------
    // --------------------------------------
    describe(`UnaryExpression`, () => {
        it(`-1`, () => {
            const expected: string = `-1`;
            const actual: string = runFormat(`-1`);
            compare(expected, actual);
        });

        it(`--1`, () => {
            const expected: string = `--1`;
            const actual: string = runFormat(`--1`);
            compare(expected, actual);
        });
    });

    // -----------------------------------
    // ---------- mixed nesting ----------
    // -----------------------------------
    describe(`mixed nesting`, () => {
        it(`[foo={},bar={}]`, () => {
            const expected: string = `
[
    foo = {},
    bar = {}
]`;
            const actual: string = runFormat(`[foo={},bar={}]`);
            compare(expected, actual);
        });

        it(`[first=[insideKey=insideValue,lst={1,2,3},emptyLst={}]]`, () => {
            const expected: string = `
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
            const actual: string = runFormat(`[first=[insideKey=insideValue,lst={1,2,3},emptyLst={}]]`);
            compare(expected, actual);
        });
    });
});
