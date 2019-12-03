// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { compare, runFormat } from "./common";

describe(`small programs`, () => {
    it(`fastPow`, () => {
        const expected: string = `
// taken from: https://en.wikipedia.org/wiki/Exponentiation_by_squaring
// removed negative powers, sure to have bugs
//
// Function exp_by_squaring(x, n)
//     if n < 0 then return exp_by_squaring(1 / x, -n);
//     else if n = 0 then return  1;
//     else if n = 1 then return  x ;
//     else if n is even then return exp_by_squaring(x * x,  n / 2);
//     else if n is odd then return x * exp_by_squaring(x * x, (n - 1) / 2);
let
    isEven = (x as number) => Number.Mod(x, 2) = 0,
    pow =
        (x as number, p as number) =>
            if p = 0 then
                1
            else if p < 0 then
                error "negative power not supported"
            else
                x * @pow(x, p - 1),
    fastPow =
        (x as number, p as number) =>
            if p = 0 then
                1
            else if p < 0 then
                error "negative power not supported"
            else if isEven(p) then
                @fastPow(x * x, p / 2)
            else
                x * @fastPow(x * x, (p - 1) / 2)
in
    fastPow(2, 8)`;
        const actual: string = runFormat(`
// taken from: https://en.wikipedia.org/wiki/Exponentiation_by_squaring
// removed negative powers, sure to have bugs
//
// Function exp_by_squaring(x, n)
//     if n < 0 then return exp_by_squaring(1 / x, -n);
//     else if n = 0 then return  1;
//     else if n = 1 then return  x ;
//     else if n is even then return exp_by_squaring(x * x,  n / 2);
//     else if n is odd then return x * exp_by_squaring(x * x, (n - 1) / 2);
let
    isEven = (x as number) => Number.Mod(x, 2) = 0,
    pow =
        (x as number, p as number) =>
            if p = 0 then
                1
            else if p < 0 then
                error "negative power not supported"
            else
                x * @pow(x, p - 1),
    fastPow =
        (x as number, p as number) =>
            if p = 0 then
                1
            else if p < 0 then
                error "negative power not supported"
            else if isEven(p) then
                @fastPow(x * x, p / 2)
            else
                x * @fastPow(x * x, (p - 1) / 2)
in
    fastPow(2, 8)`);
        compare(expected, actual);
    });
});
