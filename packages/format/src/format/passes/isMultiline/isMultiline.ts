import { Ast, CommonError, Result, ResultKind, Traverse } from "@microsoft/powerquery-parser";
import { CommentCollectionMap } from "../comment";
import { ParentMap } from "../parent";
import { IsMultilineMap } from "./common";
import * as isMultilineFirstPass from "./isMultilineFirstPass";
import * as isMultilineSecondPass from "./isMultilineSecondPass";

// runs a DFS pass followed by a BFS pass.
export function runMultipleTraversalRequests(
    ast: Ast.TDocument,
    commentCollectionMap: CommentCollectionMap,
    parentMap: ParentMap,
): Result<IsMultilineMap, CommonError.CommonError> {
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
