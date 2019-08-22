// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, Option, TComment, Traverse } from "@microsoft/powerquery-parser";

export type CommentCollectionMap = Map<number, CommentCollection>;

export interface CommentCollection {
    readonly prefixedComments: TComment[];
    prefixedCommentsContainsNewline: boolean;
}

export function tryTraverse(
    root: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    comments: ReadonlyArray<TComment>,
): Traverse.TriedTraverse<CommentCollectionMap> {
    const state: State = {
        result: new Map(),
        comments,
        commentsIndex: 0,
        maybeCurrentComment: comments[0],
    };

    return Traverse.tryTraverseAst<State, CommentCollectionMap>(
        state,
        nodeIdMapCollection,
        root,
        Traverse.VisitNodeStrategy.DepthFirst,
        visitNode,
        Traverse.expectExpandAllAstChildren,
        earlyExit,
    );
}

interface State extends Traverse.IState<CommentCollectionMap> {
    readonly comments: ReadonlyArray<TComment>;
    commentsIndex: number;
    maybeCurrentComment: Option<TComment>;
}

function earlyExit(state: State, node: Ast.TNode): boolean {
    const maybeCurrentComment: Option<TComment> = state.maybeCurrentComment;
    if (maybeCurrentComment === undefined) {
        return true;
    } else if (node.tokenRange.positionEnd.codeUnit < maybeCurrentComment.positionStart.codeUnit) {
        return true;
    } else {
        return false;
    }
}

function visitNode(state: State, node: Ast.TNode): void {
    if (!node.isLeaf) {
        return;
    }

    let maybeCurrentComment: Option<TComment> = state.maybeCurrentComment;
    while (maybeCurrentComment && maybeCurrentComment.positionStart.codeUnit < node.tokenRange.positionStart.codeUnit) {
        const currentComment: TComment = maybeCurrentComment;
        const commentMap: CommentCollectionMap = state.result;
        const nodeId: number = node.id;
        const maybeCommentCollection: Option<CommentCollection> = commentMap.get(nodeId);

        // It's the first comment for the TNode
        if (maybeCommentCollection === undefined) {
            const commentCollection: CommentCollection = {
                prefixedComments: [currentComment],
                prefixedCommentsContainsNewline: currentComment.containsNewline,
            };
            commentMap.set(nodeId, commentCollection);
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
