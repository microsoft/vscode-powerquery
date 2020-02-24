// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { AllModules, Library } from "../library";
import { LibraryDefinition, LibraryDefinitionKind } from "../library/jsonTypes";

const PowerQueryLibrary: Library = AllModules;

describe("Library export", () => {
    it("index const by name", () => {
        const definitionKey: string = "BinaryOccurrence.Required";
        const maybeLibraryDefinition: undefined | LibraryDefinition = PowerQueryLibrary.get(definitionKey);
        if (maybeLibraryDefinition === undefined) {
            throw new Error(`expected constant '${definitionKey}' was not found`);
        }
        const libraryDefinition: LibraryDefinition = maybeLibraryDefinition;

        expect(libraryDefinition.label).eq(definitionKey, "unexpected label");
        expect(libraryDefinition.summary.length).greaterThan(0, "summary should not be empty");
        expect(libraryDefinition.kind).eq(LibraryDefinitionKind.Constant);
        expect(libraryDefinition.primitiveType).eq("number");
    });

    it("index function by name", () => {
        const exportKey: string = "List.Distinct";
        const maybeLibraryDefinition: undefined | LibraryDefinition = PowerQueryLibrary.get(exportKey);
        if (maybeLibraryDefinition === undefined) {
            throw new Error(`expected constant '${exportKey}' was not found`);
        }
        const libraryDefinition: LibraryDefinition = maybeLibraryDefinition;

        expect(libraryDefinition.label !== null);
        expect(libraryDefinition.signatures !== null);
        expect(libraryDefinition.signatures.length).eq(2, "expecting 2 signatures");
        expect(libraryDefinition.signatures[0].parameters.length).eq(1, "expecting 1 parameter in first signature");
        expect(libraryDefinition.signatures[0].parameters[0].type).eq("list");
    });
});
