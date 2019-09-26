// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";

import { SignatureProviderContext } from "./symbolProviders";

export function getContextForInvokeExpression(
    expression: PQP.Inspection.InvokeExpression,
): SignatureProviderContext | undefined {
    const functionName: string | undefined = expression.maybeName;
    if (functionName) {
        let argumentOrdinal: number | undefined;
        if (expression.maybeArguments) {
            argumentOrdinal = expression.maybeArguments.positionArgumentIndex;
        }

        return {
            argumentOrdinal,
            functionName,
        };
    }

    return undefined;
}

export function getCurrentNodeAsInvokeExpression(
    inspected: PQP.Inspection.Inspected,
): PQP.Inspection.InvokeExpression | undefined {
    if (inspected.nodes.length > 0) {
        const node: PQP.Inspection.TNode = inspected.nodes[0];
        if (node.kind === PQP.Inspection.NodeKind.InvokeExpression) {
            return node;
        }
    }

    return undefined;
}
