// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs = require("fs");
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { InspectionSettings } from "@microsoft/powerquery-language-services";
import type { Position } from "vscode-languageserver-types";

import { StandardLibraryUtils } from "../../server/src/standardLibrary";

const args: ReadonlyArray<string> = process.argv;

function throwUnexpectedArgLength(): void {
    throw new Error(`Expected 4 args, found ${args.length} instead`);
}

function throwInvalidPosition(): void {
    throw new Error("The Position argument isn't in the form of lineNumberInteger,characterNumberInteger");
}

function parsePosition(raw: string): Position {
    const components: ReadonlyArray<string> = raw.split(":").map((value: string) => value.trim());
    console.log(args);
    console.log(raw);
    console.log(raw.indexOf(":"));
    console.log(components);
    console.log([components.length !== 2, !Number.isInteger(components[0]), !Number.isInteger(components[1])]);

    if (components.length !== 2) {
        throwInvalidPosition();
    }

    const chunk1: number = Number(components[0]);
    const chunk2: number = Number(components[0]);

    if (!Number.isInteger(chunk1) || !Number.isInteger(chunk2)) {
        throwInvalidPosition();
    }

    return {
        line: Number.parseInt(components[0]),
        character: Number.parseInt(components[1]),
    };
}

if (args.length < 4) {
    throwUnexpectedArgLength();
} else if (!fs.existsSync(args[2])) {
    throw new Error(`Expected the 3rd argument to be a filepath to an existing file. Received ${args[2]}`);
}

const fileContents: string = fs.readFileSync(args[2], "utf8").replace(/^\uFEFF/, "");
const position: Position = parsePosition(args[3]);

console.log(fileContents, position);

const standardLibrary: PQLS.Library.ILibrary = StandardLibraryUtils.getOrCreateStandardLibrary();

let contents: string = "";

const inspectionSettings: InspectionSettings = PQLS.InspectionUtils.createInspectionSettings(
    {
        ...PQP.DefaultSettings,
        traceManager: new PQP.Trace.BenchmarkTraceManager((message: string) => (contents += message)),
    },
    undefined,
    standardLibrary.externalTypeResolver,
);

const triedInpsect: Promise<
    PQP.Result<Promise<PQLS.Inspection.Inspected>, PQP.Lexer.LexError.TLexError | PQP.Parser.ParseError.TParseError>
> = PQLS.Inspection.tryInspect(inspectionSettings, fileContents, position, undefined);

triedInpsect
    .then(
        (
            result: PQP.Result<
                Promise<PQLS.Inspection.Inspected>,
                PQP.Lexer.LexError.TLexError | PQP.Parser.ParseError.TParseError
            >,
        ) => {
            if (PQP.ResultUtils.isOk(result)) {
                console.log("it's okay");
            } else {
                console.log("hello world");
            }
        },
    )
    .finally(() => console.log("hello world"));
