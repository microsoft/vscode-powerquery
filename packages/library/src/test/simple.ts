import "mocha";
import { expect } from "chai";
import { AllModules, Library } from "../library";

const PowerQueryLibrary: Library = AllModules;

describe("Library export", () => {
    it("index const by name", () => {
        const val = "BinaryOccurrence.Required";
        const def = PowerQueryLibrary[val];
        expect(def != null, "expected constant wasn't found");
        expect(def.label).eq(val, "unexpected label");
        expect(def.summary.length).greaterThan(0, "summary should not be empty");
    });

    it("index function by name", () => {
        const val = "List.Distinct";
        const def = PowerQueryLibrary[val];
        expect(def != null, "expected function wasn't found");
        expect(def.label != null);
        expect(def.signatures != null);
        expect(def.signatures!.length).eq(2, "expecting 2 signatures");
        expect(def.signatures![0].parameters.length).eq(1, "expecting 1 parameter in first signature");
    });
});