// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver";

import { expect } from "chai";
import "mocha";

import * as PQLS from "@microsoft/powerquery-language-services";

import * as PQP from "@microsoft/powerquery-parser";

import { StaticLibraryProvider } from "../library";

describe(`${StaticLibraryProvider.name}`, () => {
    it("index const by name", async () => {
        const provider: StaticLibraryProvider = new StaticLibraryProvider();
        const maybeSignatureHelp: LS.SignatureHelp | null = await provider.getSignatureHelp({
            functionName: "Table.AddColumn",
            argumentOrdinal: 0,
        });

        console.log(maybeSignatureHelp);

        expect(maybeSignatureHelp).to.not.equals(undefined, undefined);
    });
});
