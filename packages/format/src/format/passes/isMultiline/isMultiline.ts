import { Ast, NodeIdMap, ResultKind, Traverse } from "@microsoft/powerquery-parser";
import { CommentCollectionMap } from "../comment";
import { IsMultilineMap } from "./common";
import { tryTraverse as tryTraverseFirstPass } from "./isMultilineFirstPass";
import { tryTraverse as tryTraverseSecondPass } from "./isMultilineSecondPass";

// runs a DFS pass followed by a BFS pass.
export function tryTraverse(
    ast: Ast.TDocument,
    commentCollectionMap: CommentCollectionMap,
    nodeIdMapCollection: NodeIdMap.Collection,
): Traverse.TriedTraverse<IsMultilineMap> {
    const triedFirstPass: Traverse.TriedTraverse<IsMultilineMap> = tryTraverseFirstPass(
        ast,
        commentCollectionMap,
        nodeIdMapCollection,
    );
    if (triedFirstPass.kind === ResultKind.Err) {
        return triedFirstPass;
    }
    const isMultilineMap: IsMultilineMap = triedFirstPass.value;

    return tryTraverseSecondPass(ast, isMultilineMap, nodeIdMapCollection);
}
