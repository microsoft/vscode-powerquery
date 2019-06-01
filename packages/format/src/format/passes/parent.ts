import { Ast, Option, TokenRangeMap, Traverse } from "@microsoft/powerquery-parser";

export type ParentMap = TokenRangeMap<Ast.TNode>;

export function createTraversalRequest(ast: Ast.TNode): Request {
    return {
        ast,
        state: {
            result: new Map(),
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    };
}

export function maybeGetParent(node: Ast.TNode, parentMap: ParentMap): Option<Ast.TNode> {
    const cacheKey: string = node.tokenRange.hash;
    return parentMap.get(cacheKey);
}

interface Request extends Traverse.IRequest<State, ParentMap> {}

interface State extends Traverse.IState<ParentMap> {}

function visitNode(node: Ast.TNode, state: State): void {
    Traverse.traverseChildren(node, state, visitNodeChildren);
}

function visitNodeChildren(parent: Ast.TNode, child: Ast.TNode, state: State): void {
    const cacheKey: string = child.tokenRange.hash;
    state.result.set(cacheKey, parent);
}
