// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from "fs";
import * as path from "path";
import * as PQP from "@microsoft/powerquery-parser";
import { NoOpTraceManagerInstance } from "@microsoft/powerquery-parser/lib/powerquery-parser/common/trace";
import { Position } from "vscode-languageserver-textdocument";

import { SettingsUtils } from "./settings.ts";

export function createTraceManager(
    uri: string | undefined,
    sourceAction: string,
    position?: Position,
): PQP.Trace.TraceManager {
    if (SettingsUtils.getServerSettings().isBenchmarksEnabled) {
        return createBenchmarkTraceManager(uri, sourceAction, position) ?? NoOpTraceManagerInstance;
    } else {
        return NoOpTraceManagerInstance;
    }
}

function createBenchmarkTraceManager(
    uri: string | undefined,
    sourceAction: string,
    position?: Position,
): PQP.Trace.BenchmarkTraceManager | undefined {
    if (!uri) {
        return undefined;
    }

    let source: string = path.parse(uri).name;

    // If untitled document
    if (uri.startsWith("untitled:")) {
        source = source.slice("untitled:".length);
    }
    // Else expect it to be a file
    else {
        source = path.parse(uri).name;
    }

    if (!source) {
        return undefined;
    }

    if (position) {
        sourceAction += `L${position.line}C${position.character}`;
    }

    const logDirectory: string = path.join(process.cwd(), "vscode-powerquery-logs");

    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    let benchmarkUri: string;

    // TODO: make this not O(n)
    for (let iteration: number = 0; iteration < 1000; iteration += 1) {
        benchmarkUri = path.join(logDirectory, `${source}_${sourceAction}_${iteration}.log`);

        if (!fs.existsSync(benchmarkUri)) {
            const writeStream: fs.WriteStream = fs.createWriteStream(benchmarkUri, { flags: "w" });

            return new PQP.Trace.BenchmarkTraceManager((message: string) => writeStream.write(message));
        }
    }

    // TODO: handle fallback if all iterations are taken
    return undefined;
}
