// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import { SignatureProviderContext } from "../language-services";
import * as InspectionHelpers from "../language-services/inspectionHelpers";
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
});
