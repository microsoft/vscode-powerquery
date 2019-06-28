// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, CommonError, Option } from "@microsoft/powerquery-parser";

export type IsMultilineMap = Map<number, boolean>;

export function expectGetIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap): boolean {
    const maybeIsMultiline: Option<boolean> = isMultilineMap.get(node.id);
    if (maybeIsMultiline === undefined) {
        const details: {} = { node };
        throw new CommonError.InvariantError(`isMultiline is missing an expected nodeId`, details);
    }

    return maybeIsMultiline;
}

export function setIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap, isMultiline: boolean): void {
    isMultilineMap.set(node.id, isMultiline);
}
