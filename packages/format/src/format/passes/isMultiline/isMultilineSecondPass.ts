// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, NodeIdMap, Option, Traverse } from "@microsoft/powerquery-parser";
import { maybeGetParent } from "../common";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";

export function tryTraverse(
    ast: Ast.TNode,
    isMultilineMap: IsMultilineMap,
    nodeIdMapCollection: NodeIdMap.Collection,
): Traverse.TriedTraverse<IsMultilineMap> {
    const state: State = {
        result: isMultilineMap,
        nodeIdMapCollection,
    };
    return Traverse.tryTraverseAst(
        ast,
        nodeIdMapCollection,
        state,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

interface State extends Traverse.IState<IsMultilineMap> {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
}

// if a list or record is a child node,
// then by default it should be considered multiline if it has one or more values
function visitNode(node: Ast.TNode, state: State): void {
    switch (node.kind) {
        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const isMultilineMap: IsMultilineMap = state.result;
            const maybeParent: Option<Ast.TNode> = maybeGetParent(state.nodeIdMapCollection, node.id);
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
            if (node.content.elements.length) {
                const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

                let maybeParent: Option<Ast.TNode> = maybeGetParent(nodeIdMapCollection, node.id);
                let maybeCsv: Option<Ast.TCsv>;
                if (maybeParent && maybeParent.kind === Ast.NodeKind.Csv) {
                    maybeCsv = maybeParent;
                    maybeParent = maybeGetParent(nodeIdMapCollection, maybeParent.id);
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
