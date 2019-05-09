import "mocha";
import { expect } from "chai";
import * as Library from "../library"

describe("Library export", () => {
    it("index const by name", () => {
        const val = "BinaryOccurrence.Required";
        const def = Library.loadStandardLibrary();
        expect(def).to.exist;

        const ex = def[val];
        expect(ex.label != null);
    });

    it("index function by name", () => {
        const val = "List.Distinct";
        const def = Library.loadStandardLibrary();
        expect(def).to.exist;

        const ex = def[val];
        expect(ex.label != null);
        expect(ex.signatures != null);
        expect(ex.signatures!.length).eq(2, "expecting 2 signatures");
        expect(ex.signatures![0].parameters.length).eq(1, "expecting 1 parameter in first signature");
    });
});