import { Ast, Option, Traverse } from "@microsoft/powerquery-parser";
import { maybeGetParent, ParentMap } from "../parent";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";

export interface Request extends Traverse.IRequest<State, IsMultilineMap> {}

export function createTraversalRequest(ast: Ast.TNode, isMultilineMap: IsMultilineMap, parentMap: ParentMap): Request {
    return {
        ast,
        state: {
            result: isMultilineMap,
            parentMap,
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    };
}

interface State extends Traverse.IState<IsMultilineMap> {
    readonly parentMap: ParentMap;
}

// if a list or record is a child node,
// then by default it should be considered multiline if it has one or more values
function visitNode(node: Ast.TNode, state: State): void {
    switch (node.kind) {
        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const isMultilineMap: IsMultilineMap = state.result;
            const maybeParent: Option<Ast.TNode> = maybeGetParent(node, state.parentMap);
            if (
                maybeParent &&
                Ast.isTBinOpExpression(maybeParent) &&
                expectGetIsMultiline(maybeParent, isMultilineMap)
            ) {
                setIsMultiline(node, isMultilineMap, true);
            }
            break;
        }

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            if (node.content.length) {
                const parentMap: Map<string, Ast.TNode> = state.parentMap;

                let maybeParent: Option<Ast.TNode> = maybeGetParent(node, parentMap);
                let maybeCsv: Option<Ast.TCsv>;
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
                    }
                }
            }
            break;

        default:
            break;
    }
}
