// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs = require("fs");
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { InspectionSettings } from "@microsoft/powerquery-language-services";
import type { Position } from "vscode-languageserver-types";

import { StandardLibraryUtils } from "../server/src";

const args: ReadonlyArray<string> = process.argv;

function throwUnexpectedArgLength(): void {
    throw new Error(`Expected 4 args, found ${args.length} instead`);
}

function parsePosition(raw: string): Position {
    const components: ReadonlyArray<string> = raw.split(",").map((value: string) => value.trim());

    if (components.length !== 2 || !Number.isInteger(components[0] || !Number.isInteger(components[1]))) {
        throw new Error("The Position argument isn't in the form of lineNumberInteger,characterNumberInteger");
    }

    return {
        line: Number.parseInt(components[0]),
        character: Number.parseInt(components[1]),
    };
}

if (args.length < 4) {
    throwUnexpectedArgLength();
} else if (!fs.existsSync(args[3])) {
    throw new Error("Expected the 3rd argument to be a filepath to an existing file");
}

const fileContents: string = fs.readFileSync(args[2], "utf8").replace(/^\uFEFF/, "");
const position: Position = parsePosition(args[3]);
const standardLibrary: PQLS.Library.ILibrary = StandardLibraryUtils.getOrCreateStandardLibrary();

const inspectionSettings: InspectionSettings = PQLS.InspectionUtils.createInspectionSettings(
    {
        ...PQP.DefaultSettings,
    },
    undefined,
    standardLibrary.externalTypeResolver,
);

const foo = PQLS.Inspection.tryInspect(inspectionSettings, fileContents, position, undefined);
