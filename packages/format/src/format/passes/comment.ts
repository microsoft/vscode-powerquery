import { Ast, Option, TComment, TokenRangeMap, Traverse } from "@microsoft/powerquery-parser";

export type CommentCollectionMap = TokenRangeMap<CommentCollection>;

export interface CommentCollection {
    readonly prefixedComments: TComment[];
    prefixedCommentsContainsNewline: boolean;
}

export function createTraversalRequest(ast: Ast.TNode, comments: ReadonlyArray<TComment>): Option<Request> {
    if (!comments.length) {
        return;
    }

    return {
        ast,
        state: {
            result: new Map(),
            comments,
            commentsIndex: 0,
            maybeCurrentComment: comments[0],
        },
        maybeEarlyExitFn: earlyExit,
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.DepthFirst,
    };
}

interface Request extends Traverse.IRequest<State, CommentCollectionMap> {}

interface State extends Traverse.IState<CommentCollectionMap> {
    readonly comments: ReadonlyArray<TComment>;
    commentsIndex: number;
    maybeCurrentComment: Option<TComment>;
}

function earlyExit(node: Ast.TNode, state: State): boolean {
    const maybeCurrentComment: Option<TComment> = state.maybeCurrentComment;
    if (maybeCurrentComment === undefined) {
        return true;
    } else if (node.tokenRange.positionEnd.codeUnit < maybeCurrentComment.positionStart.codeUnit) {
        return true;
    } else {
        return false;
    }
}

function visitNode(node: Ast.TNode, state: State): void {
    if (!node.terminalNode) {
        return;
    }

    let maybeCurrentComment: Option<TComment> = state.maybeCurrentComment;
    while (maybeCurrentComment && maybeCurrentComment.positionStart.codeUnit < node.tokenRange.positionStart.codeUnit) {
        const currentComment: TComment = maybeCurrentComment;
        const commentMap: CommentCollectionMap = state.result;
        const cacheKey: string = node.tokenRange.hash;
        const maybeCommentCollection: Option<CommentCollection> = commentMap.get(cacheKey);

        // It's the first comment for the TNode
        if (maybeCommentCollection === undefined) {
            const commentCollection: CommentCollection = {
                prefixedComments: [currentComment],
                prefixedCommentsContainsNewline: currentComment.containsNewline,
            };
            commentMap.set(cacheKey, commentCollection);
        }
        // At least one comment already attached to the TNode
        else {
            const commentCollection: CommentCollection = maybeCommentCollection;
            commentCollection.prefixedComments.push(currentComment);
            if (currentComment.containsNewline) {
                commentCollection.prefixedCommentsContainsNewline = true;
            }
        }

        state.commentsIndex += 1;
        maybeCurrentComment = state.comments[state.commentsIndex];
    }

    state.maybeCurrentComment = maybeCurrentComment;
}
