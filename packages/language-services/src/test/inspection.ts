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
describe("Inspection - InvokeExpression", () => {
    it("zero parameter function", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection("Text.Guid(|)");
        expect(inspected.nodes.length).equals(1);
        expect(inspected.nodes[0].kind).equals(PQP.Inspection.NodeKind.InvokeExpression);
    });

    it("getCurrentNodeAsInvokeExpression", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection("Text.Guid(|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected);

        assert.isDefined(expression, "expression should be defined.");

        if (expression) {
            expect(expression.maybeName).equals("Text.Guid");
            assert.isDefined(expression.maybeArguments);
            expect(expression.maybeArguments!.numArguments).equals(0);
        }
    });

    it("getCurrentNodeAsInvokeExpression multiline", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection("Text.Guid(\n|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected);

        assert.isDefined(expression, "expression should be defined.");

        if (expression) {
            expect(expression.maybeName).equals("Text.Guid");
            assert.isDefined(expression.maybeArguments);
            expect(expression.maybeArguments!.numArguments).equals(0);
        }
    });

    it("getContextForInvokeExpression - Date.AddDays(d,|", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection("Date.AddDays(d,|");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected);
        const context: SignatureProviderContext | undefined = InspectionHelpers.getContextForInvokeExpression(
            expression!,
        );

        assert.isDefined(context, "context should be defined");
        if (context) {
            expect(context.functionName).to.equal("Date.AddDays");
            expect(context.argumentOrdinal).to.equal(1);
        }
    });

    it("getContextForInvokeExpression - Date.AddDays(d,1|)", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection("Date.AddDays(d,1|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected);
        const context: SignatureProviderContext | undefined = InspectionHelpers.getContextForInvokeExpression(
            expression!,
        );

        assert.isDefined(context, "context should be defined");
        if (context) {
            expect(context.functionName).to.equal("Date.AddDays");
            expect(context.argumentOrdinal).to.equal(1);
        }
    });

    it("DirectQueryForSQL file", () => {
        const document: Utils.MockDocument = Utils.createDocumentFromFile("DirectQueryForSQL.pq");
        const triedInspect: PQP.Inspection.TriedInspection | undefined = WorkspaceCache.getTriedInspection(document, {
            line: 68,
            character: 23,
        });

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

            assert.isDefined(inspected.maybePositionIdentifier, "position identifier should be defined");

            expect(inspected.maybePositionIdentifier!.identifier.kind).equals(
                PQP.Ast.NodeKind.Identifier,
                "expecting identifier",
            );

            const identifier: PQP.Ast.Identifier = inspected.maybePositionIdentifier!.identifier as PQP.Ast.Identifier;

            expect(identifier.literal).equals("OdbcDataSource");
            expect(identifier.tokenRange.positionStart.lineNumber).equals(40);
        }
    });
});

describe("Inspection - Identifiers in Scope", () => {
    it("section foo; a = 1; b = 2; c = let d = 2 in |", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection(
            "section foo; a = 1; b = 2; c = let d = 2 in |",
        );

        expectScope(inspected, ["d", "c", "b", "a"]);
    });

    it("section foo; a = 1; b = 2; c = let d = 2 in |d; e = () => true;", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection(
            "section foo; a = 1; b = 2; c = let d = 2 in |d; e = () => true;",
        );

        expectScope(inspected, ["a", "b", "d", "e"]);
    });

    it("section foo; a = 1; b = 2; c = let d = 2 in d; e = |", () => {
        const inspected: PQP.Inspection.Inspected = Utils.getInspection(
            "section foo; a = 1; b = 2; c = let d = 2 in d; e = |",
        );

        // TODO: e should not be in scope
        expectScope(inspected, ["a", "b", "c", "e"]);
    });
});
