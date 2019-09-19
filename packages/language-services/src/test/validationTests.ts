// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import "mocha";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-types";

import * as LanguageServices from "../language-services";
import * as Utils from "./utils";
import { ValidationResult } from "../language-services";

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

    // TODO: more test cases
});
