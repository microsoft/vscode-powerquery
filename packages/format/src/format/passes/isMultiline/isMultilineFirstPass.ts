import { Ast, CommonError, isNever, Option, StringHelpers, Traverse } from "@microsoft/powerquery-parser";
import { CommentCollection, CommentCollectionMap } from "../comment";
import { maybeGetParent, ParentMap } from "../parent";
import { expectGetIsMultiline, IsMultilineMap, setIsMultiline } from "./common";
import { getLinearLength, LinearLengthMap } from "./linearLength";

export interface Request extends Traverse.IRequest<State, IsMultilineMap> {}

export function createTraversalRequest(
    ast: Ast.TNode,
    commentCollectionMap: CommentCollectionMap,
    parentMap: ParentMap,
): Request {
    return {
        ast,
        state: {
            result: new Map(),
            commentCollectionMap,
            parentMap,
            linearLengthMap: new Map(),
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.DepthFirst,
        maybeEarlyExitFn: undefined,
    };
}

export interface State extends Traverse.IState<IsMultilineMap> {
    readonly commentCollectionMap: CommentCollectionMap;
    readonly parentMap: ParentMap;
    readonly linearLengthMap: LinearLengthMap;
}

const InvokeExpressionIdentifierLinearLengthExclusions: ReadonlyArray<string> = [
    "#datetime",
    "#datetimezone",
    "#duration",
    "#time",
];
const TBinOpExpressionLinearLengthThreshold: number = 30;
const TBinOpExpressionExpressionNumberThreshold: number = 3;
const InvokeExpressionLinearLengthThreshold: number = 30;

function visitNode(node: Ast.TNode, state: State): void {
    const isMultilineMap: IsMultilineMap = state.result;
    let isMultiline: boolean = false;

    switch (node.kind) {
        // TPairedConstant
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.TypePrimaryType:
            isMultiline = isAnyMultiline(isMultilineMap, node.constant, node.paired);
            break;

        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const numExpressions: number = numTBinOpExpressions(node);

            if (numExpressions > TBinOpExpressionExpressionNumberThreshold) {
                isMultiline = true;
            } else {
                const linearLength: number = getLinearLength(node, state.linearLengthMap);
                if (linearLength > TBinOpExpressionLinearLengthThreshold) {
                    isMultiline = true;
                } else {
                    isMultiline = isAnyMultilineUnaryHelper(isMultilineMap, node.rest, node.first);
                }
            }
            break;
        }

        // TBinOpKeyword
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.MetadataExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.left, node.constant, node.right);
            break;

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.key, node.equalConstant, node.value);
            break;

        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            if (node.content.length > 1) {
                isMultiline = true;
            } else {
                const isAnyChildMultiline: boolean = isAnyMultiline(
                    isMultilineMap,
                    node.openWrapperConstant,
                    node.closeWrapperConstant,
                    ...node.content,
                );
                if (isAnyChildMultiline) {
                    isMultiline = true;
                } else {
                    const csvs: ReadonlyArray<Ast.TCsv> = node.content;
                    const csvNodes: ReadonlyArray<Ast.TNode> = csvs.map((csv: Ast.TCsv) => csv.node);
                    isMultiline = isAnyListOrRecord(csvNodes);
                }
            }

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
                ...node.content,
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
                node.maybeFieldTypeSpeification,
            );
            break;

        case Ast.NodeKind.FieldSpecificationList: {
            const fields: ReadonlyArray<Ast.ICsv<Ast.FieldSpecification>> = node.content;
            if (fields.length > 1) {
                isMultiline = true;
            } else if (fields.length === 1 && node.maybeOpenRecordMarkerConstant) {
                isMultiline = true;
            }
            break;
        }

        case Ast.NodeKind.FieldTypeSpecification:
            isMultiline = isAnyMultiline(isMultilineMap, node.equalConstant, node.fieldType);
            break;

        case Ast.NodeKind.FunctionExpression:
            isMultiline = expectGetIsMultiline(node.expression, isMultilineMap);
            break;

        case Ast.NodeKind.IdentifierExpression: {
            isMultiline = isAnyMultiline(isMultilineMap, node.maybeInclusiveConstant, node.identifier);
            break;
        }

        case Ast.NodeKind.IfExpression:
            isMultiline = true;
            break;

        case Ast.NodeKind.InvokeExpression: {
            const args: ReadonlyArray<Ast.ICsv<Ast.TExpression>> = node.content;

            if (args.length > 1) {
                const linearLengthMap: LinearLengthMap = state.linearLengthMap;
                const linearLength: number = getLinearLength(node, linearLengthMap);
                const maybeParent: Option<Ast.TNode> = maybeGetParent(node, state.parentMap);
                if (!maybeParent || maybeParent.kind !== Ast.NodeKind.RecursivePrimaryExpression) {
                    const details: {} = {
                        node,
                        maybeParent,
                    };
                    throw new CommonError.InvariantError(
                        "InvokeExpression must have RecursivePrimaryExpression as a parent",
                        details,
                    );
                }

                const headLinearLength: number = getLinearLength(maybeParent.head, linearLengthMap);
                const compositeLinearLength: number = linearLength + headLinearLength;

                // if it's beyond the threshold check if it's a long literal
                // ex. `#datetimezone(2013,02,26, 09,15,00, 09,00)`
                if (compositeLinearLength > InvokeExpressionLinearLengthThreshold) {
                    const maybeInvokeIdentifier: Option<Ast.IdentifierExpression> = maybeGetInvokeExpressionIdentifier(
                        node,
                        state,
                    );
                    if (maybeInvokeIdentifier) {
                        if (maybeInvokeIdentifier.maybeInclusiveConstant) {
                            isMultiline = true;
                        } else {
                            const identifierLiteral: string = maybeInvokeIdentifier.identifier.literal;
                            isMultiline =
                                InvokeExpressionIdentifierLinearLengthExclusions.indexOf(identifierLiteral) === -1;
                        }
                    }
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

        case Ast.NodeKind.ParenthesizedExpression:
            isMultiline = isAnyMultiline(
                isMultilineMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.PrimitiveType:
            isMultiline = expectGetIsMultiline(node.primitiveType, isMultilineMap);
            break;

        case Ast.NodeKind.RecordType:
            isMultiline = expectGetIsMultiline(node.fields, isMultilineMap);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            isMultiline = isAnyMultiline(isMultilineMap, node.head, ...node.recursiveExpressions);
            break;

        case Ast.NodeKind.Section:
            if (node.sectionMembers.length) {
                isMultiline = true;
            } else {
                isMultiline = isAnyMultiline(
                    isMultilineMap,
                    node.maybeLiteralAttributes,
                    node.sectionConstant,
                    node.maybeName,
                    node.semicolonConstant,
                    ...node.sectionMembers,
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
            isMultiline = isAnyMultilineUnaryHelper(isMultilineMap, node.expressions);
            break;

        case Ast.NodeKind.UnaryExpressionHelper:
            isMultiline = isAnyMultiline(isMultilineMap, node.operatorConstant, node.node);
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
            isNever(node);
    }

    setIsMultilineWithCommentCheck(node, state, isMultiline);
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

function isAnyMultiline(isMultilineMap: IsMultilineMap, ...maybeNodes: Option<Ast.TNode>[]): boolean {
    for (const maybeNode of maybeNodes) {
        if (maybeNode && expectGetIsMultiline(maybeNode, isMultilineMap)) {
            return true;
        }
    }

    return false;
}

function isAnyMultilineUnaryHelper(
    isMultilineMap: IsMultilineMap,
    unaryExpressions: ReadonlyArray<Ast.TUnaryExpressionHelper>,
    ...nodes: Ast.TNode[]
): boolean {
    for (const unaryExpression of unaryExpressions) {
        nodes.push(unaryExpression.node);
    }
    return isAnyMultiline(isMultilineMap, ...nodes);
}

function setIsMultilineWithCommentCheck(node: Ast.TNode, state: State, isMultiline: boolean): void {
    if (precededByMultilineComment(node, state)) {
        isMultiline = true;
    }

    setIsMultiline(node, state.result, isMultiline);
}

function precededByMultilineComment(node: Ast.TNode, state: State): boolean {
    const cacheKey: string = node.tokenRange.hash;
    const maybeCommentCollection: Option<CommentCollection> = state.commentCollectionMap.get(cacheKey);
    if (maybeCommentCollection) {
        return maybeCommentCollection.prefixedCommentsContainsNewline;
    } else {
        return false;
    }
}

// InvokeExpression can be preceeded by an identifier, ex. '#datetimezone(...)'
function maybeGetInvokeExpressionIdentifier(
    node: Ast.InvokeExpression,
    state: State,
): Option<Ast.IdentifierExpression> {
    const maybeRecursivePrimaryExpression: Option<Ast.TNode> = maybeGetParent(node, state.parentMap);
    if (
        !maybeRecursivePrimaryExpression ||
        maybeRecursivePrimaryExpression.kind !== Ast.NodeKind.RecursivePrimaryExpression
    ) {
        const details: {} = {
            node,
            parent,
        };
        throw new CommonError.InvariantError(
            "InvokeExpression should always have a RecursivePrimaryExpression as a parent",
            details,
        );
    }
    const recursivePrimaryExpression: Ast.RecursivePrimaryExpression = maybeRecursivePrimaryExpression;

    const recursiveExpressions: Option<ReadonlyArray<Ast.TRecursivePrimaryExpression>> =
        recursivePrimaryExpression.recursiveExpressions;
    if (recursiveExpressions.length !== 1) {
        return undefined;
    } else {
        const head: Ast.TPrimaryExpression = recursivePrimaryExpression.head;
        if (head.kind !== Ast.NodeKind.IdentifierExpression) {
            return undefined;
        } else {
            return head;
        }
    }
}

function numTBinOpExpressions(node: Ast.TNode): number {
    if (Ast.isTBinOpExpression(node)) {
        let numberOfChildArgs: number = numTBinOpExpressions(node.first);
        for (const child of node.rest) {
            numberOfChildArgs += numTBinOpExpressions(child);
        }

        return numberOfChildArgs;
    } else {
        return 1;
    }
}

function containsNewline(text: string): boolean {
    const textLength: number = text.length;

    for (let index: number = 0; index < textLength; index += 1) {
        if (StringHelpers.maybeNewlineKindAt(text, index)) {
            return true;
        }
    }
    return false;
}
