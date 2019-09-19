// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-types";

import * as LanguageServices from "../language-services";
import * as Utils from "./utils";
import { ValidationResult } from "../language-services";

// TODO: more test cases
describe("validation", () => {
    it("no errors", () => {
        const document: TextDocument = Utils.createDocument("let\n   b = 1\n   in b");
        const validationResult: ValidationResult = LanguageServices.validate(document);
        expect(validationResult.hasErrors).to.be.false;
        expect(validationResult.diagnostics).to.be.empty;
    });

    it("single line query with error", () => {
        const document: TextDocument = Utils.createDocument("let a = 1,");
        const validationResult: ValidationResult = LanguageServices.validate(document);
        expect(validationResult.hasErrors).to.be.true;
        expect(validationResult.diagnostics.length).to.equal(1);
        Utils.validateError(validationResult.diagnostics[0], { line: 0, character: 9 });
    });
});

describe("validation with workspace cache", () => {
    it("no errors after update", () => {
        const document: Utils.MockDocument = Utils.createDocument("let a = 1,");
        let validationResult: ValidationResult = LanguageServices.validate(document);
        expect(validationResult.hasErrors).to.be.true;

        document.setText("1");
        LanguageServices.documentUpdated(document);

        validationResult = LanguageServices.validate(document);
        expect(validationResult.hasErrors).to.be.false;
    });

    it("errors after update", () => {
        const document: Utils.MockDocument = Utils.createDocument("let a = 1 in a");
        let validationResult: ValidationResult = LanguageServices.validate(document);
        expect(validationResult.hasErrors).to.be.false;

        document.setText(";;;;;;");
        LanguageServices.documentUpdated(document);

        validationResult = LanguageServices.validate(document);
        expect(validationResult.hasErrors).to.be.true;
    });
});