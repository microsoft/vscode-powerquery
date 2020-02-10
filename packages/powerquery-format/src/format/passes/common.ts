// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, NodeIdMapUtils } from "@microsoft/powerquery-parser";

export function maybeGetParent(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): Ast.TNode | undefined {
    const maybeParentNodeId: number | undefined = nodeIdMapCollection.parentIdById.get(nodeId);
    if (maybeParentNodeId === undefined) {
        return undefined;
    }
    const parentNodeId: number = maybeParentNodeId;
    return NodeIdMapUtils.expectAstNode(nodeIdMapCollection.astNodeById, parentNodeId);
}
