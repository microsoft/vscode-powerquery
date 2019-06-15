import { Ast, CommonError, Result, ResultKind, Traverse, NodeIdMap } from "@microsoft/powerquery-parser";
import { CommentCollectionMap } from "../comment";
import { IsMultilineMap } from "./common";
import * as isMultilineFirstPass from "./isMultilineFirstPass";
import * as isMultilineSecondPass from "./isMultilineSecondPass";

// runs a DFS pass followed by a BFS pass.
export function runMultipleTraversalRequests(
    ast: Ast.TDocument,
    commentCollectionMap: CommentCollectionMap,
    nodeIdMapCollection: NodeIdMap.Collection,
): Traverse.TriedTraverse<IsMultilineMap> {
    const firstPassRequest: isMultilineFirstPass.Request = isMultilineFirstPass.createTraversalRequest(
        ast,
        commentCollectionMap,
        parentMap,
    );
    const firstPassResult: Result<IsMultilineMap, CommonError.CommonError> = Traverse.traverseAst(firstPassRequest);
    if (firstPassResult.kind === ResultKind.Err) {
        return firstPassResult;
    }

    const secondPassRequest: isMultilineSecondPass.Request = isMultilineSecondPass.createTraversalRequest(
        ast,
        firstPassResult.value,
        parentMap,
    );
    return Traverse.traverseAst(secondPassRequest);
}
