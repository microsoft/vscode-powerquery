import {
    Ast,
    CommonError,
    isNever,
    Option,
    Result,
    ResultKind,
    TokenRangeMap,
    Traverse,
} from "@microsoft/powerquery-parser";

export type LinearLengthMap = TokenRangeMap<number>;

// Lazy evaluation of a potentially large AST.
// Returns the text length of the node if IsMultiline is set to false.
// Nodes which can't ever have a linear length (such as IfExpressions) will evaluate to NaN.
export function getLinearLength(node: Ast.TNode, linearLengthMap: LinearLengthMap): number {
    const cacheKey: string = node.tokenRange.hash;
    const maybeLinearLength: Option<number> = linearLengthMap.get(cacheKey);

    if (maybeLinearLength === undefined) {
        const linearLength: number = calculateLinearLength(node, linearLengthMap);
        linearLengthMap.set(cacheKey, linearLength);
        return linearLength;
    } else {
        return maybeLinearLength;
    }
}

interface Request extends Traverse.IRequest<State, number> {}

interface State extends Traverse.IState<number> {
    linearLengthMap: LinearLengthMap;
}

function calculateLinearLength(node: Ast.TNode, linearLengthMap: LinearLengthMap): number {
    const linearLengthRequest: Request = createTraversalRequest(node, linearLengthMap);
    const linearLengthResult: Result<number, CommonError.CommonError> = Traverse.traverseAst(linearLengthRequest);

    if (linearLengthResult.kind === ResultKind.Err) {
        throw linearLengthResult.error;
    } else {
        return linearLengthResult.value;
    }
}

function createTraversalRequest(ast: Ast.TNode, linearLengthMap: LinearLengthMap): Request {
    return {
        ast,
        state: {
            result: 0,
            linearLengthMap,
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.DepthFirst,
        maybeEarlyExitFn: undefined,
    };
}

function visitNode(node: Ast.TNode, state: State): void {
    let linearLength: number;

    switch (node.kind) {
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.ErrorRaisingExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression:
        case Ast.NodeKind.TypePrimaryType:
            linearLength = sumLinearLengths(1, state.linearLengthMap, node.constant, node.paired);
            break;

        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression:
            linearLength = sumLinearLengths(2 * node.rest.length, state.linearLengthMap, node.first, ...node.rest);
            break;

        // TBinOpKeyword
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.MetadataExpression: {
            linearLength = sumLinearLengths(2, state.linearLengthMap, node.left, node.constant, node.right);
            break;
        }

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            linearLength = sumLinearLengths(2, state.linearLengthMap, node.key, node.equalConstant, node.value);
            break;

        // TWrapped where Content is TCsv[] and no extra attributes
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ParameterList:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            linearLength = sumLinearLengths(
                node.content.length ? node.content.length - 1 : 0,
                state.linearLengthMap,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                ...node.content,
            );
            break;

        case Ast.NodeKind.Constant:
            linearLength = node.literal.length;
            break;

        case Ast.NodeKind.Csv:
            linearLength = sumLinearLengths(0, state.linearLengthMap, node.node, node.maybeCommaConstant);
            break;

        case Ast.NodeKind.ErrorHandlingExpression: {
            let initialLength: number = 1;
            if (node.maybeOtherwiseExpression) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                initialLength,
                state.linearLengthMap,
                node.tryConstant,
                node.protectedExpression,
                node.maybeOtherwiseExpression,
            );
            break;
        }

        case Ast.NodeKind.FieldProjection:
            linearLength = sumLinearLengths(
                0,
                state.linearLengthMap,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
                ...node.content,
            );
            break;

        case Ast.NodeKind.FieldSelector:
            linearLength = sumLinearLengths(
                0,
                state.linearLengthMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
                node.maybeOptionalConstant,
            );
            break;

        case Ast.NodeKind.FieldSpecification:
            linearLength = sumLinearLengths(
                0,
                state.linearLengthMap,
                node.maybeOptionalConstant,
                node.name,
                node.maybeFieldTypeSpeification,
            );
            break;

        case Ast.NodeKind.FieldSpecificationList: {
            let initialLength: number = 0;
            if (node.maybeOpenRecordMarkerConstant && node.content.length) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                initialLength,
                state.linearLengthMap,
                node.openWrapperConstant,
                node.closeWrapperConstant,
                node.maybeOpenRecordMarkerConstant,
                ...node.content,
            );
            break;
        }

        case Ast.NodeKind.FieldTypeSpecification:
            linearLength = sumLinearLengths(2, state.linearLengthMap, node.equalConstant, node.fieldType);
            break;

        case Ast.NodeKind.FunctionExpression: {
            let initialLength: number = 2;
            if (node.maybeFunctionReturnType) {
                initialLength += 2;
            }
            linearLength = sumLinearLengths(
                initialLength,
                state.linearLengthMap,
                node.parameters,
                node.maybeFunctionReturnType,
                node.fatArrowConstant,
                node.expression,
            );
            break;
        }

        case Ast.NodeKind.FunctionType:
            linearLength = sumLinearLengths(
                2,
                state.linearLengthMap,
                node.functionConstant,
                node.parameters,
                node.functionReturnType,
            );
            break;

        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
            linearLength = node.literal.length;
            break;

        case Ast.NodeKind.IdentifierExpression:
            linearLength = sumLinearLengths(0, state.linearLengthMap, node.maybeInclusiveConstant, node.identifier);
            break;

        case Ast.NodeKind.ItemAccessExpression:
            linearLength = sumLinearLengths(
                0,
                state.linearLengthMap,
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
                0,
                state.linearLengthMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.NotImplementedExpression:
            linearLength = sumLinearLengths(0, state.linearLengthMap, node.ellipsisConstant);
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
                initialLength,
                state.linearLengthMap,
                node.maybeOptionalConstant,
                node.name,
                node.maybeParameterType,
            );
            break;
        }

        case Ast.NodeKind.ParenthesizedExpression:
            linearLength = sumLinearLengths(
                0,
                state.linearLengthMap,
                node.openWrapperConstant,
                node.content,
                node.closeWrapperConstant,
            );
            break;

        case Ast.NodeKind.PrimitiveType:
            linearLength = getLinearLength(node.primitiveType, state.linearLengthMap);
            break;

        case Ast.NodeKind.RecordType:
            linearLength = sumLinearLengths(0, state.linearLengthMap, node.fields);
            break;

        case Ast.NodeKind.RecursivePrimaryExpression:
            linearLength = sumLinearLengths(0, state.linearLengthMap, node.head, ...node.recursiveExpressions);
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
                initialLength,
                state.linearLengthMap,
                node.maybeLiteralAttributes,
                node.maybeSharedConstant,
                node.namePairedExpression,
                node.semicolonConstant,
            );
            break;
        }

        case Ast.NodeKind.Section: {
            if (node.sectionMembers.length) {
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
                    initialLength,
                    state.linearLengthMap,
                    node.maybeLiteralAttributes,
                    node.sectionConstant,
                    node.maybeName,
                    node.semicolonConstant,
                    ...node.sectionMembers,
                );
            }
            break;
        }

        case Ast.NodeKind.TableType:
            linearLength = sumLinearLengths(1, state.linearLengthMap, node.tableConstant, node.rowType);
            break;

        case Ast.NodeKind.UnaryExpression:
            linearLength = sumLinearLengths(0, state.linearLengthMap, ...node.expressions);
            break;

        case Ast.NodeKind.UnaryExpressionHelper:
            linearLength = sumLinearLengths(0, state.linearLengthMap, node.operatorConstant, node.node);
            break;

        // is always multiline, therefore cannot have linear line length
        case Ast.NodeKind.IfExpression:
        case Ast.NodeKind.LetExpression:
            linearLength = NaN;
            break;

        default:
            throw isNever(node);
    }

    const cacheKey: string = node.tokenRange.hash;
    state.linearLengthMap.set(cacheKey, linearLength);
    state.result = linearLength;
}

function sumLinearLengths(
    initialLength: number,
    linearLengthMap: LinearLengthMap,
    ...maybeNodes: Option<Ast.TNode>[]
): number {
    let summedLinearLength: number = initialLength;
    for (const maybeNode of maybeNodes) {
        if (maybeNode) {
            const nodeLinearLength: number = getLinearLength(maybeNode, linearLengthMap);
            summedLinearLength += nodeLinearLength;
        }
    }

    return summedLinearLength;
}
