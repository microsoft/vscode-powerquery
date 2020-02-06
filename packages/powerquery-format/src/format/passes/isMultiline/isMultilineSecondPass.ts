// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, AstUtils, ILocalizationTemplates, NodeIdMap, Traverse } from "@microsoft/powerquery-parser";
import { maybeGetParent } from "../common";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";

export function tryTraverse(
    localizationTemplates: ILocalizationTemplates,
    ast: Ast.TNode,
    isMultilineMap: IsMultilineMap,
    nodeIdMapCollection: NodeIdMap.Collection,
): Traverse.TriedTraverse<IsMultilineMap> {
    const state: State = {
        localizationTemplates,
        result: isMultilineMap,
        nodeIdMapCollection,
    };

    return Traverse.tryTraverseAst(
        state,
        nodeIdMapCollection,
        ast,
        Traverse.VisitNodeStrategy.BreadthFirst,
        visitNode,
        Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

interface State extends Traverse.IState<IsMultilineMap> {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
}

function visitNode(state: State, node: Ast.TNode): void {
    switch (node.kind) {
        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const isMultilineMap: IsMultilineMap = state.result;
            const maybeParent: Ast.TNode | undefined = maybeGetParent(state.nodeIdMapCollection, node.id);
            if (
                maybeParent &&
                AstUtils.isTBinOpExpression(maybeParent) &&
                expectGetIsMultiline(isMultilineMap, maybeParent)
            ) {
                setIsMultiline(isMultilineMap, node, true);
            }
            break;
        }

        // If a list or record is a child node,
        // Then by default it should be considered multiline if it has one or more values
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            if (node.content.elements.length) {
                const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;

                let maybeParent: Ast.TNode | undefined = maybeGetParent(nodeIdMapCollection, node.id);
                let maybeCsv: Ast.TCsv | undefined;
                let maybeArrayWrapper: Ast.TArrayWrapper | undefined;
                if (maybeParent && maybeParent.kind === Ast.NodeKind.Csv) {
                    maybeCsv = maybeParent;
                    maybeParent = maybeGetParent(nodeIdMapCollection, maybeParent.id);
                }
                if (maybeParent && maybeParent.kind === Ast.NodeKind.ArrayWrapper) {
                    maybeArrayWrapper = maybeParent;
                    maybeParent = maybeGetParent(nodeIdMapCollection, maybeParent.id);
                }

                if (maybeParent) {
                    const parent: Ast.TNode = maybeParent;
                    switch (parent.kind) {
                        case Ast.NodeKind.ItemAccessExpression:
                        case Ast.NodeKind.InvokeExpression:
                        case Ast.NodeKind.FunctionExpression:
                        case Ast.NodeKind.Section:
                        case Ast.NodeKind.SectionMember:
                            break;

                        default: {
                            const isMultilineMap: IsMultilineMap = state.result;
                            setIsMultiline(isMultilineMap, parent, true);
                            if (maybeCsv) {
                                setIsMultiline(isMultilineMap, maybeCsv, true);
                            }
                            if (maybeArrayWrapper) {
                                setIsMultiline(isMultilineMap, maybeArrayWrapper, true);
                            }
                            setIsMultiline(isMultilineMap, node, true);
                            setIsMultiline(isMultilineMap, node.content, true);
                        }
                    }
                }
            }
            break;

        default:
            break;
    }
}
