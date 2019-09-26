// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import "mocha";

import * as InspectionHelpers from "../language-services/inspectionHelpers";
import * as Utils from "./utils";

// tslint:disable: no-unnecessary-type-assertion

// Unit testing for analysis operations related to power query parser inspection results.
describe("Inspection", () => {
    it("zero parameter function", () => {
        const inspected: PQP.Inspection.Inspected | undefined = Utils.getInspection("Text.Guid(|)");
        assert.isDefined(inspected);
        expect(inspected!.nodes.length).equals(1);
        expect(inspected!.nodes[0].kind).equals(PQP.Inspection.NodeKind.InvokeExpression);
    });

    it("getCurrentNodeAsInvokeExpression", () => {
        const inspected: PQP.Inspection.Inspected | undefined = Utils.getInspection("Text.Guid(|)");
        const expression:
            | PQP.Inspection.InvokeExpression
            | undefined = InspectionHelpers.getCurrentNodeAsInvokeExpression(inspected!);

        if (expression) {
            expect(expression.maybeName).equals("Text.Guid");
            assert.isDefined(expression.maybeArguments);
            expect(expression.maybeArguments!.numArguments).equals(0);
        } else {
            assert.fail("invoke expression was null");
        }
    });
});
