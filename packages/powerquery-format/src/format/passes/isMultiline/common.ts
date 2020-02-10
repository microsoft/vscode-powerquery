// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, CommonError } from "@microsoft/powerquery-parser";

export type IsMultilineMap = Map<number, boolean>;

export function expectGetIsMultiline(isMultilineMap: IsMultilineMap, node: Ast.TNode): boolean {
    const maybeIsMultiline: boolean | undefined = isMultilineMap.get(node.id);
    if (maybeIsMultiline === undefined) {
        const details: {} = { nodeId: node.id };
        throw new CommonError.InvariantError(`isMultiline is missing an expected nodeId`, details);
    }

    return maybeIsMultiline;
}

export function setIsMultiline(isMultilineMap: IsMultilineMap, node: Ast.TNode, isMultiline: boolean): void {
    isMultilineMap.set(node.id, isMultiline);
}
