import { expect } from "chai";
import "mocha";
import { SignatureHelp } from "vscode-languageserver-types";

import * as Utils from "./utils";

const emptySignatureHelp: SignatureHelp = {
    signatures: [],
    // tslint:disable-next-line: no-null-keyword
    activeParameter: null,
    activeSignature: 0,
};

describe("Signature Help (null provider))", () => {
    it("cursor on function", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.Gu|id()");
        expect(result).deep.equals(emptySignatureHelp);
    });

    it("after open parens", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.FromNumber(|");
        expect(result).deep.equals(emptySignatureHelp);
    });

    it("after parameter value", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.FromNumber(1|)");
        expect(result).deep.equals(emptySignatureHelp);
    });

    it("after close parens", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Text.FromNumber(1)|");
        expect(result).deep.equals(emptySignatureHelp);
    });

    it("on second parameter", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Date.AddDays(a,|)");
        expect(result).deep.equals(emptySignatureHelp);
    });

    it("on second parameter (with space)", async () => {
        const result: SignatureHelp = await Utils.getSignatureHelp("Date.AddDays(a, |)");
        expect(result).deep.equals(emptySignatureHelp);
    });
});
