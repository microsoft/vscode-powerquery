// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, isNever, NodeIdMap, Option, ResultKind, Traverse } from "@microsoft/powerquery-parser";

export type LinearLengthMap = Map<number, number>;

// Lazy evaluation of a potentially large AST.
// Returns the text length of the node if IsMultiline is set to false.
// Nodes which can't ever have a linear length (such as IfExpressions) will evaluate to NaN.
export function getLinearLength(
    linearLengthMap: LinearLengthMap,
    nodeIdMapCollection: NodeIdMap.Collection,
    node: Ast.TNode,
): number {
    const nodeId: number = node.id;
    const maybeLinearLength: Option<number> = linearLengthMap.get(nodeId);

    if (maybeLinearLength === undefined) {
        const linearLength: number = calculateLinearLength(node, nodeIdMapCollection, linearLengthMap);
        linearLengthMap.set(nodeId, linearLength);
        return linearLength;
    } else {
        return maybeLinearLength;
    }
}

interface State extends Traverse.IState<number> {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly linearLengthMap: LinearLengthMap;
}

function calculateLinearLength(
    node: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    linearLengthMap: LinearLengthMap,
): number {
    const state: State = {
        result: 0,
        nodeIdMapCollection,
        linearLengthMap,
    };

    const triedTraverse: Traverse.TriedTraverse<number> = Traverse.tryTraverseAst(
        state,
        nodeIdMapCollection,
        node,
        Traverse.VisitNodeStrategy.DepthFirst,
        visitNode,
        Traverse.expectExpandAllAstChildren,
        undefined,
    );

    if (triedTraverse.kind === ResultKind.Err) {
        throw triedTraverse.error;
    } else {
        return triedTraverse.value;
    }
}

function visitNode(state: State, node: Ast.TNode): void {
    let linearLength: number;

    switch (node.kind) {
        // TPairedConstant
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.IsNullablePrimitiveType:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.TypePrimaryType:
            linearLength = sumLinearLengths(state, 1, node.constant, node.paired);
            break;

        // TBinOpExpression
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            linearLength = sumLinearLengths(state, 2, node.left, node.operatorConstant, node.right);
            break;
        }

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            linearLength = sumLinearLengths(state, 2, node.key, node.equalConstant, node.value);
            break;

        // TWrapped where Content is TCsv[] and no extra attributes
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            const elements: ReadonlyArray<Ast.TCsv> = node.content.elements;
            const numElements: number = elements.length;
            linearLength = sumLinearLengths(
                state,
                numElements ? numElements - 1 : 0,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                ...elements,
            );
            break;
        }

        case Ast.NodeKind.ArrayWrapper:
            linearLength = sumLinearLengths(state, 0, ...node.elements);
            break;

        case Ast.NodeKind.Constant:
            linearLength = node.literal.length;
            break;

        case Ast.NodeKind.Csv:
            linearLength = sumLinearLengths(state, 0, node.node, node.maybeCommaConstant);
            break;

        case Ast.NodeKind.ErrorHandlingExpression: {
            let initialLength: number = 1;
            if (node.maybeOtherwiseExpression) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.tryConstant,
                node.protectedExpression,
                node.maybeOtherwiseExpression,
            );
            break;
        }

        case Ast.NodeKind.FieldProjection:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
                ...node.content.elements,
            );
            break;

        case Ast.NodeKind.FieldSelector:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case Ast.NodeKind.FieldSpecification:
            linearLength = sumLinearLengths(
                state,
                0,
                node.maybeOptionalConstant,
                node.name,
                node.maybeFieldTypeSpeification,
            );
            break;

        case Ast.NodeKind.FieldSpecificationList: {
            const elements: ReadonlyArray<Ast.ICsv<Ast.FieldSpecification>> = node.content.elements;
            let initialLength: number = 0;
            if (node.maybeOpenRecordMarkerConstant && elements.length) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOpenRecordMarkerConstant,
                ...elements,
            );
            break;
        }

        case Ast.NodeKind.FieldTypeSpecification:
            linearLength = sumLinearLengths(state, 2, node.equalConstant, node.fieldType);
            break;

        case Ast.NodeKind.FunctionExpression: {
            let initialLength: number = 2;
            if (node.maybeFunctionReturnType) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.parameters,
                node.maybeFunctionReturnType,
                node.fatArrowConstant,
                node.expression,
            );
            break;
        }

        case Ast.NodeKind.FunctionType:
            linearLength = sumLinearLengths(state, 2, node.functionConstant, node.parameters, node.functionReturnType);
            break;

        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
            linearLength = node.literal.length;
            break;

        case Ast.NodeKind.IdentifierExpression:
            linearLength = sumLinearLengths(state, 0, node.maybeInclusiveConstant, node.identifier);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case Ast.NodeKind.LiteralExpression:
            linearLength = node.literal.length;
            break;

        case Ast.NodeKind.ListType:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.MetadataExpression: {
            linearLength = sumLinearLengths(state, 2, node.left, node.operatorConstant, node.right);
            break;
        }

        case Ast.NodeKind.NotImplementedExpression:
            linearLength = sumLinearLengths(state, 0, node.ellipsisConstant);
            break;

        case Ast.NodeKind.Parameter: {
            let initialLength: number = 0;
            if (node.maybeOptionalConstant) {
                initialLength += 1;
            }
            if (node.maybeParameterType) {
                initialLength += 1;
            }
            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.maybeOptionalConstant,
                node.name,
                node.maybeParameterType,
            );
            break;
        }

        case Ast.NodeKind.ParenthesizedExpression:
            linearLength = sumLinearLengths(
                state,
                0,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.PrimitiveType:
            linearLength = getLinearLength(state.linearLengthMap, state.nodeIdMapCollection, node.primitiveType);
            break;

        case Ast.NodeKind.RangeExpression:
            linearLength = sumLinearLengths(state, 0, node.left, node.rangeConstant, node.right);
            break;

        case Ast.NodeKind.RecordType:
            linearLength = sumLinearLengths(state, 0, node.fields);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            linearLength = sumLinearLengths(state, 0, node.head, ...node.recursiveExpressions.elements);
            break;

        case Ast.NodeKind.SectionMember: {
            let initialLength: number = 0;
            if (node.maybeLiteralAttributes) {
                initialLength += 1;
            }
            if (node.maybeSharedConstant) {
                initialLength += 1;
            }

            linearLength = sumLinearLengths(
                state,
                initialLength,
                node.maybeLiteralAttributes,
                node.maybeSharedConstant,
                node.namePairedExpression,
                node.semicolonConstant,
            );
            break;
        }

        case Ast.NodeKind.Section: {
            const sectionMembers: ReadonlyArray<Ast.SectionMember> = node.sectionMembers.elements;
            if (sectionMembers.length) {
                linearLength = NaN;
            } else {
                let initialLength: number = 0;
                if (node.maybeLiteralAttributes) {
                    initialLength += 1;
                }
                if (node.maybeName) {
                    initialLength += 1;
                }

                linearLength = sumLinearLengths(
                    state,
                    initialLength,
                    node.maybeLiteralAttributes,
                    node.sectionConstant,
                    node.maybeName,
                    node.semicolonConstant,
                    ...sectionMembers,
                );
            }
            break;
        }

        case Ast.NodeKind.TableType:
            linearLength = sumLinearLengths(state, 1, node.tableConstant, node.rowType);
            break;

        case Ast.NodeKind.UnaryExpression:
            linearLength = sumLinearLengths(state, 1, node.typeExpression, ...node.operators.elements);
            break;

        // is always multiline, therefore cannot have linear line length
        case Ast.NodeKind.IfExpression:
        case Ast.NodeKind.LetExpression:
            linearLength = NaN;
            break;

        default:
            throw isNever(node);
    }

    state.linearLengthMap.set(node.id, linearLength);
    state.result = linearLength;
}

function sumLinearLengths(state: State, initialLength: number, ...maybeNodes: Option<Ast.TNode>[]): number {
    let summedLinearLength: number = initialLength;
    for (const maybeNode of maybeNodes) {
        if (maybeNode) {
            const nodeLinearLength: number = getLinearLength(
                state.linearLengthMap,
                state.nodeIdMapCollection,
                maybeNode,
            );
            summedLinearLength += nodeLinearLength;
        }
    }

    return summedLinearLength;
}
