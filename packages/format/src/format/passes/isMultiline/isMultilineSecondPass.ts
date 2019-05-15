import { Ast, Traverse } from "@microsoft/powerquery-parser";
import { maybeGetParent, ParentMap } from "../parent";
import { getIsMultiline, IsMultilineMap, setIsMultiline } from "./common";

export function createTraversalRequest(
    ast: Ast.TNode,
    isMultilineMap: IsMultilineMap,
    parentMap: ParentMap,
): Request {
    return {
        ast,
        state: {
            result: isMultilineMap,
            parentMap,
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    }
}

interface Request extends Traverse.IRequest<State, IsMultilineMap> { }

interface State extends Traverse.IState<IsMultilineMap> {
    readonly parentMap: ParentMap,
}

// if a list or record is a child node,
// then by default it should be considered multiline if it has one or more values
function visitNode(node: Ast.TNode, state: State) {
    switch (node.kind) {
        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const isMultilineMap = state.result;
            const maybeParent = maybeGetParent(node, state.parentMap);
            if (maybeParent && Ast.isTBinOpExpression(maybeParent) && getIsMultiline(maybeParent, isMultilineMap)) {
                setIsMultiline(node, isMultilineMap, true);
            }
            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            if (node.content.length) {
                const parentMap = state.parentMap;

                let maybeParent = maybeGetParent(node, parentMap);
                let maybeCsv;
                if (maybeParent && maybeParent.kind === Ast.NodeKind.Csv) {
                    maybeCsv = maybeParent;
                    maybeParent = maybeGetParent(maybeParent, parentMap);
                }

                if (maybeParent) {
                    switch (maybeParent.kind) {
                        case Ast.NodeKind.ItemAccessExpression:
                        case Ast.NodeKind.InvokeExpression:
                        case Ast.NodeKind.FunctionExpression:
                        case Ast.NodeKind.Section:
                        case Ast.NodeKind.SectionMember:
                            break;

                        default:
                            setIsMultiline(maybeParent, state.result, true);
                            if (maybeCsv) {
                                setIsMultiline(maybeCsv, state.result, true);
                            }
                            setIsMultiline(node, state.result, true);
                            break;
                    }
                }
            }
    }
}
