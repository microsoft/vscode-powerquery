// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(rootDirectory, "scripts", "vsixContents.txt");
const supportedArguments = new Set(["--update"]);
const updateBaseline = process.argv.includes("--update");
const unsupportedArguments = process.argv.slice(2).filter(argument => !supportedArguments.has(argument));

if (unsupportedArguments.length > 0) {
    throw new Error(`Unexpected argument(s): ${unsupportedArguments.join(", ")}`);
}

const packageJson = JSON.parse(await readFile(path.join(rootDirectory, "package.json"), "utf8"));
const vsixPath = path.join(rootDirectory, `${packageJson.name}-${packageJson.version}.vsix`);
let vsixContents;

try {
    vsixContents = await readFile(vsixPath);
} catch (error) {
    if (error.code !== "ENOENT") {
        throw error;
    }

    const availableVsixFiles = (await readdir(rootDirectory)).filter(fileName => fileName.endsWith(".vsix"));

    throw new Error(
        `Expected VSIX "${path.basename(vsixPath)}" was not found. ` +
            `Run "npm run vsix" first. Found: ${availableVsixFiles.join(", ") || "none"}`,
    );
}

const archive = await JSZip.loadAsync(vsixContents);
const fileNames = Object.values(archive.files)
    .filter(file => !file.dir)
    .map(file => file.name)
    .sort();

for (const fileName of fileNames) {
    await archive.file(fileName).async("uint8array");
}

const actualBaseline = `${fileNames.join("\n")}\n`;

if (updateBaseline) {
    await writeFile(baselinePath, actualBaseline, "utf8");
    console.log(`Updated ${path.relative(rootDirectory, baselinePath)} with ${fileNames.length} VSIX files.`);
} else {
    let expectedBaseline;

    try {
        expectedBaseline = await readFile(baselinePath, "utf8");
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }

        throw new Error(
            `VSIX baseline "${path.relative(rootDirectory, baselinePath)}" was not found. ` +
                'Run "npm run vsix:update-baseline" after reviewing the package contents.',
        );
    }

    const expectedFiles = new Set(expectedBaseline.trimEnd().split(/\r?\n/).filter(Boolean));
    const actualFiles = new Set(fileNames);
    const unexpectedFiles = fileNames.filter(fileName => !expectedFiles.has(fileName));
    const missingFiles = [...expectedFiles].filter(fileName => !actualFiles.has(fileName));

    if (unexpectedFiles.length > 0 || missingFiles.length > 0) {
        const differences = [];

        if (unexpectedFiles.length > 0) {
            differences.push(`Unexpected files:\n${unexpectedFiles.map(fileName => `  + ${fileName}`).join("\n")}`);
        }

        if (missingFiles.length > 0) {
            differences.push(`Missing files:\n${missingFiles.map(fileName => `  - ${fileName}`).join("\n")}`);
        }

        throw new Error(
            `VSIX contents differ from ${path.relative(rootDirectory, baselinePath)}.\n\n${differences.join(
                "\n\n",
            )}\n\nIf intentional, review the VSIX and run "npm run vsix:update-baseline".`,
        );
    }

    console.log(`VSIX contents match ${path.relative(rootDirectory, baselinePath)} (${fileNames.length} files).`);
}
