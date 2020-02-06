// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Ast,
    AstUtils,
    CommonError,
    ILocalizationTemplates,
    isNever,
    NodeIdMap,
    NodeIdMapUtils,
    StringUtils,
    Traverse,
} from "@microsoft/powerquery-parser";
import { CommentCollection, CommentCollectionMap } from "../comment";
import { maybeGetParent } from "../common";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";
import { getLinearLength, LinearLengthMap } from "./linearLength";

export function tryTraverse(
    localizationTemplates: ILocalizationTemplates,
    ast: Ast.TNode,
    commentCollectionMap: CommentCollectionMap,
    nodeIdMapCollection: NodeIdMap.Collection,
): Traverse.TriedTraverse<IsMultilineMap> {
    const state: State = {
        localizationTemplates,
        result: new Map(),
        commentCollectionMap,
        nodeIdMapCollection,
        linearLengthMap: new Map(),
    };

    return Traverse.tryTraverseAst<State, IsMultilineMap>(
        state,
        nodeIdMapCollection,
        ast,
        Traverse.VisitNodeStrategy.DepthFirst,
        visitNode,
        Traverse.expectExpandAllAstChildren,
        undefined,
    );
}

export interface State extends Traverse.IState<IsMultilineMap> {
    readonly localizationTemplates: ILocalizationTemplates;
    readonly commentCollectionMap: CommentCollectionMap;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly linearLengthMap: LinearLengthMap;
}

const InvokeExpressionIdentifierLinearLengthExclusions: ReadonlyArray<string> = [
    "#datetime",
    "#datetimezone",
    "#duration",
    "#time",
];
const TBinOpExpressionLinearLengthThreshold: number = 40;
const InvokeExpressionLinearLengthThreshold: number = 40;

function visitNode(state: State, node: Ast.TNode): void {
    const isMultilineMap: IsMultilineMap = state.result;
    let isMultiline: boolean = false;

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
            isMultiline = isAnyMultiline(isMultilineMap, node.constant, node.paired);
            break;

        // TBinOpExpression
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const left: Ast.TNode = node.left;
            const right: Ast.TNode = node.right;

            if (
                (AstUtils.isTBinOpExpression(left) && containsLogicalExpression(left)) ||
                (AstUtils.isTBinOpExpression(right) && containsLogicalExpression(right))
            ) {
                isMultiline = true;
            }
            const linearLength: number = getLinearLength(
                state.localizationTemplates,
                state.linearLengthMap,
                state.nodeIdMapCollection,
                node,
            );
            if (linearLength > TBinOpExpressionLinearLengthThreshold) {
                isMultiline = true;
            } else {
                isMultiline = isAnyMultiline(isMultilineMap, left, node.operatorConstant, right);
            }

            break;
        }

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.key, node.equalConstant, node.value);
            break;

        // Possible for a parent to assign an isMultiline override.
        case Ast.NodeKind.ArrayWrapper:
            isMultiline = isAnyMultiline(isMultilineMap, ...node.elements);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            if (node.content.elements.length > 1) {
                isMultiline = true;
            } else {
                const isAnyChildMultiline: boolean = isAnyMultiline(
                    isMultilineMap,
                    node.openWrapperConstant,
                    node.closeWrapperConstant,
                    ...node.content.elements,
                );
                if (isAnyChildMultiline) {
                    isMultiline = true;
                } else {
                    const csvs: ReadonlyArray<Ast.TCsv> = node.content.elements;
                    const csvNodes: ReadonlyArray<Ast.TNode> = csvs.map((csv: Ast.TCsv) => csv.node);
                    isMultiline = isAnyListOrRecord(csvNodes);
                }
            }

            setIsMultiline(isMultilineMap, node.content, isMultiline);
            break;
        }

        case Ast.NodeKind.Csv:
            isMultiline = isAnyMultiline(isMultilineMap, node.node, node.maybeCommaConstant);
            break;

        case Ast.NodeKind.ErrorHandlingExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.tryConstant,
                node.protectedExpression,
                node.maybeOtherwiseExpression,
            );
            break;

        case Ast.NodeKind.FieldProjection:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
                ...node.content.elements,
            );
            break;

        case Ast.NodeKind.FieldSelector:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case Ast.NodeKind.FieldSpecification:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.maybeOptionalConstant,
                node.name,
                node.maybeFieldTypeSpecification,
            );
            break;

        case Ast.NodeKind.FieldSpecificationList: {
            const fieldArray: Ast.ICsvArray<Ast.FieldSpecification> = node.content;
            const fields: ReadonlyArray<Ast.ICsv<Ast.FieldSpecification>> = fieldArray.elements;
            if (fields.length > 1) {
                isMultiline = true;
            } else if (fields.length === 1 && node.maybeOpenRecordMarkerConstant) {
                isMultiline = true;
            }
            setIsMultiline(isMultilineMap, fieldArray, isMultiline);
            break;
        }

        case Ast.NodeKind.FieldTypeSpecification:
            isMultiline = isAnyMultiline(isMultilineMap, node.equalConstant, node.fieldType);
            break;

        case Ast.NodeKind.FunctionExpression:
            isMultiline = expectGetIsMultiline(isMultilineMap, node.expression);
            break;

        case Ast.NodeKind.IdentifierExpression: {
            isMultiline = isAnyMultiline(isMultilineMap, node.maybeInclusiveConstant, node.identifier);
            break;
        }

        case Ast.NodeKind.IfExpression:
            isMultiline = true;
            break;

        case Ast.NodeKind.InvokeExpression: {
            const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
            const args: ReadonlyArray<Ast.ICsv<Ast.TExpression>> = node.content.elements;

            if (args.length > 1) {
                const linearLengthMap: LinearLengthMap = state.linearLengthMap;
                const linearLength: number = getLinearLength(
                    state.localizationTemplates,
                    linearLengthMap,
                    nodeIdMapCollection,
                    node,
                );

                const maybeArrayWrapper: Ast.TNode | undefined = maybeGetParent(nodeIdMapCollection, node.id);
                if (maybeArrayWrapper === undefined || maybeArrayWrapper.kind !== Ast.NodeKind.ArrayWrapper) {
                    throw new CommonError.InvariantError("InvokeExpression must have ArrayWrapper as a parent");
                }
                const arrayWrapper: Ast.IArrayWrapper<Ast.TNode> = maybeArrayWrapper;

                const maybeRecursivePrimaryExpression: Ast.TNode | undefined = maybeGetParent(
                    nodeIdMapCollection,
                    arrayWrapper.id,
                );
                if (
                    maybeRecursivePrimaryExpression === undefined ||
                    maybeRecursivePrimaryExpression.kind !== Ast.NodeKind.RecursivePrimaryExpression
                ) {
                    throw new CommonError.InvariantError(
                        "ArrayWrapper must have RecursivePrimaryExpression as a parent",
                    );
                }
                const recursivePrimaryExpression: Ast.RecursivePrimaryExpression = maybeRecursivePrimaryExpression;

                const headLinearLength: number = getLinearLength(
                    state.localizationTemplates,
                    linearLengthMap,
                    nodeIdMapCollection,
                    recursivePrimaryExpression.head,
                );
                const compositeLinearLength: number = headLinearLength + linearLength;

                // if it's beyond the threshold check if it's a long literal
                // ex. `#datetimezone(2013,02,26, 09,15,00, 09,00)`
                if (compositeLinearLength > InvokeExpressionLinearLengthThreshold) {
                    const maybeName: string | undefined = NodeIdMapUtils.maybeInvokeExpressionName(
                        nodeIdMapCollection,
                        node.id,
                    );
                    if (maybeName) {
                        const name: string = maybeName;
                        isMultiline = InvokeExpressionIdentifierLinearLengthExclusions.indexOf(name) === -1;
                    }

                    setIsMultiline(isMultilineMap, node.content, isMultiline);
                } else {
                    isMultiline = isAnyMultiline(
                        isMultilineMap,
                        node.openWrapperConstant,
                        node.closeWrapperConstant,
                        ...args,
                    );
                }
            } else {
                // a single argument can still be multiline
                // ex. `foo(if true then 1 else 0)`
                isMultiline = isAnyMultiline(
                    isMultilineMap,
                    node.openWrapperConstant,
                    node.closeWrapperConstant,
                    ...args,
                );
            }
            break;
        }

        case Ast.NodeKind.ItemAccessExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.maybeOptionalConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case Ast.NodeKind.LetExpression:
            isMultiline = true;
            setIsMultiline(isMultilineMap, node.variableList, true);
            break;

        case Ast.NodeKind.LiteralExpression:
            if (node.literalKind === Ast.LiteralKind.Str && containsNewline(node.literal)) {
                isMultiline = true;
            }
            break;

        case Ast.NodeKind.ListType:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.MetadataExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.left, node.operatorConstant, node.right);
            break;

        case Ast.NodeKind.ParenthesizedExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.PrimitiveType:
            isMultiline = expectGetIsMultiline(isMultilineMap, node.primitiveType);
            break;

        case Ast.NodeKind.RangeExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.left, node.rangeConstant, node.right);
            break;

        case Ast.NodeKind.RecordType:
            isMultiline = expectGetIsMultiline(isMultilineMap, node.fields);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.head, ...node.recursiveExpressions.elements);
            break;

        case Ast.NodeKind.Section:
            if (node.sectionMembers.elements.length) {
                isMultiline = true;
            } else {
                isMultiline = isAnyMultiline(
                    isMultilineMap,
                    node.maybeLiteralAttributes,
                    node.sectionConstant,
                    node.maybeName,
                    node.semicolonConstant,
                    ...node.sectionMembers.elements,
                );
            }
            break;

        case Ast.NodeKind.SectionMember:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.maybeLiteralAttributes,
                node.maybeSharedConstant,
                node.namePairedExpression,
                node.semicolonConstant,
            );
            break;

        case Ast.NodeKind.TableType:
            isMultiline = isAnyMultiline(isMultilineMap, node.tableConstant, node.rowType);
            break;

        case Ast.NodeKind.UnaryExpression:
            isMultiline = isAnyMultiline(isMultilineMap, ...node.operators.elements);
            break;

        // no-op nodes
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.FunctionType:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.NotImplementedExpression:
        case Ast.NodeKind.Parameter:
        case Ast.NodeKind.ParameterList:
            break;

        default:
            throw isNever(node);
    }

    setIsMultilineWithCommentCheck(state, node, isMultiline);
}

function isAnyListOrRecord(nodes: ReadonlyArray<Ast.TNode>): boolean {
    for (const node of nodes) {
        switch (node.kind) {
            case Ast.NodeKind.ListExpression:
            case Ast.NodeKind.ListLiteral:
            case Ast.NodeKind.RecordExpression:
            case Ast.NodeKind.RecordLiteral:
                return true;

            default:
                break;
        }
    }

    return false;
}

function isAnyMultiline(isMultilineMap: IsMultilineMap, ...maybeNodes: (Ast.TNode | undefined)[]): boolean {
    for (const maybeNode of maybeNodes) {
        if (maybeNode && expectGetIsMultiline(isMultilineMap, maybeNode)) {
            return true;
        }
    }

    return false;
}

function setIsMultilineWithCommentCheck(state: State, node: Ast.TNode, isMultiline: boolean): void {
    if (precededByMultilineComment(state, node)) {
        isMultiline = true;
    }

    setIsMultiline(state.result, node, isMultiline);
}

function precededByMultilineComment(state: State, node: Ast.TNode): boolean {
    const maybeCommentCollection: CommentCollection | undefined = state.commentCollectionMap.get(node.id);
    if (maybeCommentCollection) {
        return maybeCommentCollection.prefixedCommentsContainsNewline;
    } else {
        return false;
    }
}

function containsNewline(text: string): boolean {
    const textLength: number = text.length;

    for (let index: number = 0; index < textLength; index += 1) {
        if (StringUtils.maybeNewlineKindAt(text, index)) {
            return true;
        }
    }
    return false;
}

function containsLogicalExpression(node: Ast.TBinOpExpression): boolean {
    if (!AstUtils.isTBinOpExpression(node)) {
        return false;
    }
    const left: Ast.TNode = node.left;
    const right: Ast.TNode = node.right;

    return (
        node.kind === Ast.NodeKind.LogicalExpression ||
        (AstUtils.isTBinOpExpression(left) && containsLogicalExpression(left)) ||
        (AstUtils.isTBinOpExpression(right) && containsLogicalExpression(right))
    );
}
