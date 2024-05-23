// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs = require("fs");
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { InspectionSettings } from "@microsoft/powerquery-language-services";

import { LibrarySymbolUtils, LibraryUtils } from "../../server/src/library";

const args: ReadonlyArray<string> = process.argv;

function throwUnexpectedArgLength(): void {
    throw new Error(`Expected 4 args, found ${args.length} instead`);
}

function throwInvalidPosition(): void {
    throw new Error("The Position argument isn't in the form of lineNumberInteger,characterNumberInteger");
}

function parsePosition(raw: string): PQLS.Position {
    const components: ReadonlyArray<string> = raw.split(":").map((value: string) => value.trim());

    if (components.length !== 2) {
        throwInvalidPosition();
    }

    const chunk1: number = Number(components[0]);
    const chunk2: number = Number(components[1]);

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

let contents: string = "";

const fileContents: string = fs.readFileSync(args[2], "utf8").replace(/^\uFEFF/, "");
const position: PQLS.Position = parsePosition(args[3]);

const library: PQLS.Library.ILibrary = LibraryUtils.createLibrary(
    [LibrarySymbolUtils.getSymbolsForLocaleAndMode(PQP.Locale.en_US, "Power Query")],
    [],
);

const inspectionSettings: InspectionSettings = PQLS.InspectionUtils.inspectionSettings(
    {
        ...PQP.DefaultSettings,
        traceManager: new PQP.Trace.BenchmarkTraceManager((message: string) => (contents += message)),
    },
    {
        isWorkspaceCacheAllowed: true,
        library,
    },
);

const triedInspect: Promise<
    PQP.Result<Promise<PQLS.Inspection.Inspected>, PQP.Lexer.LexError.TLexError | PQP.Parser.ParseError.TParseError>
> = PQLS.Inspection.tryInspect(inspectionSettings, fileContents, position, undefined);

triedInspect
    .then(
        (
            result: PQP.Result<
                Promise<PQLS.Inspection.Inspected>,
                PQP.Lexer.LexError.TLexError | PQP.Parser.ParseError.TParseError
            >,
        ) => {
            console.log(`isOk: ${PQP.ResultUtils.isOk(result)}`);
        },
    )
    .catch((error: unknown) => {
        throw error;
    })
    .finally(() => console.log(contents));
