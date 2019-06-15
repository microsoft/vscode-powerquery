import { Ast, NodeIdMap, Option } from "@microsoft/powerquery-parser";

export function maybeGetParent(nodeIdMapCollection: NodeIdMap.Collection, nodeId: number): Option<Ast.TNode> {
    const maybeParentNodeId: Option<number> = nodeIdMapCollection.parentIdById.get(nodeId);
    if (maybeParentNodeId === undefined) {
        return undefined;
    }
    const parentNodeId: number = maybeParentNodeId;
    return NodeIdMap.expectAstNode(nodeIdMapCollection.astNodeById, parentNodeId);
}
