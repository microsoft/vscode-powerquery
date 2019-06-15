// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { AllModules, Library } from "../library";
import { Export } from "../library/jsonTypes";

const PowerQueryLibrary: Library = AllModules;

describe("Library export", () => {
    it("index const by name", () => {
        const exportKey: string = "BinaryOccurrence.Required";
        const maybeLibraryExport: undefined | Export = PowerQueryLibrary.get(exportKey);
        if (maybeLibraryExport === undefined) {
            throw new Error(`expected constant '${exportKey}' was not found`);
        }
        const libraryExport: Export = maybeLibraryExport;

        expect(libraryExport.label).eq(exportKey, "unexpected label");
        expect(libraryExport.summary.length).greaterThan(0, "summary should not be empty");
    });

    it("index function by name", () => {
        const exportKey: string = "List.Distinct";
        const maybeLibraryExport: undefined | Export = PowerQueryLibrary.get(exportKey);
        if (maybeLibraryExport === undefined) {
            throw new Error(`expected constant '${exportKey}' was not found`);
        }
        const libraryExport: Export = maybeLibraryExport;

        expect(libraryExport.label !== null);
        expect(libraryExport.signatures !== null);
        expect(libraryExport.signatures.length).eq(2, "expecting 2 signatures");
        expect(libraryExport.signatures[0].parameters.length).eq(1, "expecting 1 parameter in first signature");
    });
});
