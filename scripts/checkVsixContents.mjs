// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(rootDirectory, "scripts", "vsixContents.txt");
const supportedArguments = new Set(["--update"]);

function getZipEntryNames(contents) {
    const endOfCentralDirectorySignature = 0x06054b50;
    const centralDirectoryEntrySignature = 0x02014b50;
    const maximumEndOfCentralDirectorySize = 22 + 0xffff;
    let endOfCentralDirectoryOffset = -1;

    for (
        let offset = contents.length - 4;
        offset >= Math.max(0, contents.length - maximumEndOfCentralDirectorySize);
        offset -= 1
    ) {
        if (
            contents.readUInt32LE(offset) === endOfCentralDirectorySignature &&
            offset + 22 + contents.readUInt16LE(offset + 20) === contents.length
        ) {
            endOfCentralDirectoryOffset = offset;
            break;
        }
    }

    if (endOfCentralDirectoryOffset < 0) {
        throw new Error("Could not find the VSIX central directory.");
    }

    const entryCount = contents.readUInt16LE(endOfCentralDirectoryOffset + 10);
    const centralDirectorySize = contents.readUInt32LE(endOfCentralDirectoryOffset + 12);
    const centralDirectoryOffset = contents.readUInt32LE(endOfCentralDirectoryOffset + 16);

    if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
        throw new Error("ZIP64 VSIX archives are not supported by the contents check.");
    }

    const fileNames = [];
    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    let entryOffset = centralDirectoryOffset;
    let entriesSeen = 0;

    while (entryOffset < centralDirectoryEnd) {
        if (contents.readUInt32LE(entryOffset) !== centralDirectoryEntrySignature) {
            throw new Error(`Invalid VSIX central directory entry at offset ${entryOffset}.`);
        }

        const fileNameLength = contents.readUInt16LE(entryOffset + 28);
        const extraFieldLength = contents.readUInt16LE(entryOffset + 30);
        const fileCommentLength = contents.readUInt16LE(entryOffset + 32);
        const externalAttributes = contents.readUInt32LE(entryOffset + 38);
        const fileNameStart = entryOffset + 46;
        const fileName = contents.subarray(fileNameStart, fileNameStart + fileNameLength).toString("utf8");
        const isDirectory = fileName.endsWith("/") || Boolean((externalAttributes >>> 16) & 0x4000);

        if (!isDirectory) {
            fileNames.push(fileName);
        }

        entryOffset = fileNameStart + fileNameLength + extraFieldLength + fileCommentLength;
        entriesSeen += 1;
    }

    if (entryOffset !== centralDirectoryEnd || entriesSeen !== entryCount) {
        throw new Error("The VSIX central directory length is invalid.");
    }

    const seenFileNames = new Set();
    const duplicateFileNames = fileNames.filter(fileName => {
        if (seenFileNames.has(fileName)) {
            return true;
        }

        seenFileNames.add(fileName);
        return false;
    });

    if (duplicateFileNames.length > 0) {
        throw new Error(`VSIX contains duplicate file entries: ${[...new Set(duplicateFileNames)].join(", ")}`);
    }

    return fileNames.sort();
}

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

await JSZip.loadAsync(vsixContents, { checkCRC32: true });
const fileNames = getZipEntryNames(vsixContents);

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
