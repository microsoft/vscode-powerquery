// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import { SignatureProviderContext } from "../language-services";
import * as InspectionHelpers from "../language-services/inspectionHelpers";
import * as WorkspaceCache from "../language-services/workspaceCache";
import * as Utils from "./utils";

// tslint:disable: no-unnecessary-type-assertion

function expectScope(inspected: PQP.Inspection.Inspected, expected: string[]): void {
    expect(inspected.scope).to.have.keys(expected);
}

// Unit testing for analysis operations related to power query parser inspection results.
describe("InspectedInvokeExpression", () => {
    describe("getContextForInspected", () => {
        it("Date.AddDays(d|,", () => {
            const inspected: PQP.Inspection.Inspected = Utils.getInspection("Date.AddDays(d|,");
            const maybeContext: SignatureProviderContext | undefined = InspectionHelpers.getContextForInspected(
                inspected,
            );
            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.maybeFunctionName).to.equal("Date.AddDays");
            expect(context.maybeArgumentOrdinal).to.equal(0);
        });

        it("Date.AddDays(d,|", () => {
            const inspected: PQP.Inspection.Inspected = Utils.getInspection("Date.AddDays(d,|");
            const maybeContext: SignatureProviderContext | undefined = InspectionHelpers.getContextForInspected(
                inspected,
            );
            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.maybeFunctionName).to.equal("Date.AddDays");
            expect(context.maybeArgumentOrdinal).to.equal(1);
        });

        it("Date.AddDays(d,1|", () => {
            const inspected: PQP.Inspection.Inspected = Utils.getInspection("Date.AddDays(d,1|");
            const maybeContext: SignatureProviderContext | undefined = InspectionHelpers.getContextForInspected(
                inspected,
            );
            assert.isDefined(maybeContext);
            const context: SignatureProviderContext = maybeContext!;

            expect(context.maybeFunctionName).to.equal("Date.AddDays");
            expect(context.maybeArgumentOrdinal).to.equal(1);
        });

        describe("file", () => {
            it("DirectQueryForSQL file", () => {
                const document: Utils.MockDocument = Utils.createDocumentFromFile("DirectQueryForSQL.pq");
                const triedInspect: PQP.Inspection.TriedInspection | undefined = WorkspaceCache.getTriedInspection(
                    document,
                    {
                        line: 68,
                        character: 23,
                    },
                );

                if (triedInspect === undefined) {
                    throw new Error("triedInspect should not be undefined");
                }

                expect(triedInspect.kind).equals(PQP.ResultKind.Ok);

                if (triedInspect && triedInspect.kind === PQP.ResultKind.Ok) {
                    const inspected: PQP.Inspection.Inspected = triedInspect.value;

                    expectScope(inspected, [
                        "ConnectionString",
                        "Credential",
                        "CredentialConnectionString",
                        "DirectSQL",
                        "DirectSQL.Icons",
                        "DirectSQL.UI",
                        "OdbcDataSource",
                        "database",
                        "server",
                    ]);

                    assert.isDefined(inspected.maybeIdentifierUnderPosition, "position identifier should be defined");

                    expect(inspected.maybeIdentifierUnderPosition!.identifier.kind).equals(
                        PQP.Ast.NodeKind.Identifier,
                        "expecting identifier",
                    );

                    const identifier: PQP.Ast.Identifier = inspected.maybeIdentifierUnderPosition!
                        .identifier as PQP.Ast.Identifier;

                    expect(identifier.literal).equals("OdbcDataSource");
                    expect(identifier.tokenRange.positionStart.lineNumber).equals(40);
                }
            });
        });
    });
});
