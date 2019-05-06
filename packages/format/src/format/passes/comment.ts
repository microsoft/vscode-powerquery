import { TokenRangeMap, Ast, TComment, Option, Traverse, CommonError } from "powerquery-parser";

export type CommentCollectionMap = TokenRangeMap<CommentCollection>;

export interface CommentCollection {
    readonly prefixedComments: TComment[],
    prefixedCommentsContainsNewline: boolean,
}

export function createTraversalRequest(ast: Ast.TNode, comments: ReadonlyArray<TComment>): Option<Request> {
    if (!comments.length) {
        return;
    }

    return {
        ast,
        state: {
            result: {},
            comments,
            commentsIndex: 0,
            currentComment: comments[0],
        },
        maybeEarlyExitFn: earlyExit,
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.DepthFirst,
    }
}

interface Request extends Traverse.IRequest<State, CommentCollectionMap> { }

interface State extends Traverse.IState<CommentCollectionMap> {
    readonly comments: ReadonlyArray<TComment>,
    commentsIndex: number,
    currentComment: Option<TComment>,
}

function earlyExit(node: Ast.TNode, state: State): boolean {
    const currentComment = state.currentComment;
    if (!currentComment) {
        return true;
    }
    else if (node.tokenRange.tokenEndIndex < currentComment.phantomTokenIndex) {
        return true;
    }
    else {
        return false;
    }
}

function visitNode(node: Ast.TNode, state: State) {
    if (!node.terminalNode) {
        return;
    }

    let currentComment = state.currentComment;
    while (currentComment && currentComment.phantomTokenIndex === node.tokenRange.tokenStartIndex) {
        attachCurrentComment(node, state);
        currentComment = state.currentComment;
    }
}

function attachCurrentComment(node: Ast.TNode, state: State) {
    const comment = state.currentComment;
    if (!comment) {
        throw new CommonError.InvariantError("tried attaching currentComment but there are no comments left");
    }

    const commentMap = state.result;
    const cacheKey = node.tokenRange.hash;
    const commentCollection = commentMap[cacheKey];
    if (!commentCollection) {
        commentMap[cacheKey] = {
            prefixedComments: [comment],
            prefixedCommentsContainsNewline: comment.containsNewline,
        };
    }
    else {
        commentCollection.prefixedComments.push(comment);
        if (comment.containsNewline) {
            commentCollection.prefixedCommentsContainsNewline = true;
        }
    }

    state.commentsIndex += 1;
    state.currentComment = state.comments[state.commentsIndex];
}
