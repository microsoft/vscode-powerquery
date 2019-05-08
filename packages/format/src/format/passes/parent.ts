import { Ast, Option, TokenRangeMap, Traverse } from "powerquery-parser";

export type ParentMap = TokenRangeMap<Ast.TNode>;

export function createTraversalRequest(ast: Ast.TNode): Request {
    return {
        ast,
        state: {
            result: {},
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    }
}

export function maybeGetParent(node: Ast.TNode, parentMap: ParentMap): Option<Ast.TNode> {
    const cacheKey = node.tokenRange.hash;
    return parentMap[cacheKey];
}

interface Request extends Traverse.IRequest<State, ParentMap> { }

interface State extends Traverse.IState<ParentMap> { }

function visitNode(node: Ast.TNode, state: State) {
    Traverse.traverseChildren(node, state, visitNodeChildren);
}

function visitNodeChildren(parent: Ast.TNode, child: Ast.TNode, state: State) {
    const cacheKey = child.tokenRange.hash;
    state.result[cacheKey] = parent;
}
