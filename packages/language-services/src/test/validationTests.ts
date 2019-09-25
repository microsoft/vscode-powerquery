// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";
import "mocha";
import { TextDocument } from "vscode-languageserver-types";

import { documentUpdated, validate, ValidationResult } from "../language-services";
import * as Utils from "./utils";

// TODO: more test cases
describe("validation", () => {
    it("no errors", () => {
        const document: TextDocument = Utils.createDocument("let\n   b = 1\n   in b");
        const validationResult: ValidationResult = validate(document);
        expect(validationResult.hasErrors).to.equal(false, "validation result is not expected to have errors.");
        expect(validationResult.diagnostics).to.be.empty("diagnostics should be empty.");
    });

    it("single line query with error", () => {
        const document: TextDocument = Utils.createDocument("let a = 1,");
        const validationResult: ValidationResult = validate(document);
        expect(validationResult.hasErrors).to.equal(true, "validation result is expected to have errors");
        expect(validationResult.diagnostics.length).to.equal(1);
        Utils.validateError(validationResult.diagnostics[0], { line: 0, character: 9 });
    });
});

describe("validation with workspace cache", () => {
    it("no errors after update", () => {
        const document: Utils.MockDocument = Utils.createDocument("let a = 1,");
        let validationResult: ValidationResult = validate(document);
        expect(validationResult.hasErrors).to.equal(true, "validation result is expected to have errors");

        document.setText("1");
        documentUpdated(document);

        validationResult = validate(document);
        expect(validationResult.hasErrors).to.equal(false, "validation result is not expected to have errors.");
    });

    it("errors after update", () => {
        const document: Utils.MockDocument = Utils.createDocument("let a = 1 in a");
        let validationResult: ValidationResult = validate(document);
        expect(validationResult.hasErrors).to.equal(false, "validation result is not expected to have errors.");

        document.setText(";;;;;;");
        documentUpdated(document);

        validationResult = validate(document);
        expect(validationResult.hasErrors).to.equal(true, "validation result is expected to have errors");
    });
});
