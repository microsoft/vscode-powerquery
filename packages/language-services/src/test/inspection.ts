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

// Unit testing for analysis operations related to power query parser inspection results.
describe("Inspection", () => {
    it("zero parameter function", () => {
        const inspected: PQP.Inspection.Inspected | undefined = Utils.getInspection("Text.Guid(|)");
        expect(inspected!.nodes.length).equals(1);
        expect(inspected!.nodes[0].kind).equals(PQP.Inspection.NodeKind.InvokeExpression);
    });

    it("getCurrentNodeAsInvokeExpression", () => {
        const inspected: PQP.Inspection.Inspected | undefined = Utils.getInspection("Text.Guid(|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected!);

        assert.isDefined(expression, "expression should be defined.");

        if (expression) {
            expect(expression.maybeName).equals("Text.Guid");
            assert.isDefined(expression.maybeArguments);
            expect(expression.maybeArguments!.numArguments).equals(0);
        }
    });

    it("getCurrentNodeAsInvokeExpression multiline", () => {
        const inspected: PQP.Inspection.Inspected | undefined = Utils.getInspection("Text.Guid(\n|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected!);

        assert.isDefined(expression, "expression should be defined.");

        if (expression) {
            expect(expression.maybeName).equals("Text.Guid");
            assert.isDefined(expression.maybeArguments);
            expect(expression.maybeArguments!.numArguments).equals(0);
        }
    });

    it("getContextForInvokeExpression", () => {
        const inspected: PQP.Inspection.Inspected | undefined = Utils.getInspection("Date.AddDays(d,|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected!);
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
        const triedInspect: PQP.Inspection.TriedInspect | undefined = WorkspaceCache.getInspection(document, {
            line: 68,
            character: 23,
        });

        expect(triedInspect!.kind).equals(PQP.ResultKind.Ok);

        if (triedInspect && triedInspect.kind === PQP.ResultKind.Ok) {
            const inspected: PQP.Inspection.Inspected = triedInspect.value;
            expect(inspected.scope.size).to.equal(4);

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
