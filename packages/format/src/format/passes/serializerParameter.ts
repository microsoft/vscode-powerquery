import { Ast, CommonError, isNever, Option, TComment, TokenRangeMap, Traverse } from "@microsoft/powerquery-parser";
import { CommentCollectionMap } from "./comment";
import { getIsMultiline, IsMultilineMap } from "./isMultiline/common";
import { maybeGetParent, ParentMap } from "./parent";

// TNodes (in general) have two responsibilities:
// * if given a Workspace, then propagate the SerializerWriteKind to their first child,
//   this is done using propagateWorkspace(parentNode, childNode, state)
// * suggest an indentation change and SerializerWriteKind for their children,
//   this is done using setWorkspace(childNode, state, workspace)

export type IndentationChange = -1 | 1;

export const enum SerializerWriteKind {
    Any = "Any",
    DoubleNewline = "DoubleNewline",
    Indented = "Indented",
    PaddedLeft = "PaddedLeft",
    PaddedRight = "PaddedRight",
}

export interface SerializerParameterMap {
    readonly indentationChange: TokenRangeMap<IndentationChange>,
    readonly writeKind: TokenRangeMap<SerializerWriteKind>,
    readonly comments: TokenRangeMap<ReadonlyArray<SerializeCommentParameter>>,
}

export interface SerializeCommentParameter {
    readonly literal: string,
    readonly writeKind: SerializerWriteKind,
}

export function createTraversalRequest(
    ast: Ast.TNode,
    parentMap: ParentMap,
    commentCollectionMap: CommentCollectionMap,
    isMultilineMap: IsMultilineMap,
): Request {
    return {
        ast,
        state: {
            result: {
                writeKind: {},
                indentationChange: {},
                comments: {},
            },
            parentMap,
            commentCollectionMap,
            isMultilineMap,
            workspaceMap: {},
        },
        visitNodeFn: visitNode,
        visitNodeStrategy: Traverse.VisitNodeStrategy.BreadthFirst,
        maybeEarlyExitFn: undefined,
    }
}

export function getSerializerWriteKind(
    node: Ast.TNode,
    serializerParametersMap: SerializerParameterMap
): SerializerWriteKind {
    const cacheKey = node.tokenRange.hash;
    const maybeWriteKind = serializerParametersMap.writeKind[cacheKey];
    if (maybeWriteKind) {
        return maybeWriteKind;
    }
    else {
        throw new CommonError.InvariantError("expected node to be in SerializerParameterMap.writeKind", node);
    }
}

interface Request extends Traverse.IRequest<State, SerializerParameterMap> { }

interface State extends Traverse.IState<SerializerParameterMap> {
    readonly parentMap: ParentMap,
    readonly commentCollectionMap: CommentCollectionMap,
    readonly isMultilineMap: IsMultilineMap,
    readonly workspaceMap: TokenRangeMap<Workspace>,
}

// temporary storage used during traversal
interface Workspace {
    readonly maybeIndentationChange?: IndentationChange,
    readonly maybeWriteKind?: SerializerWriteKind,
}

const DefaultWorkspace: Workspace = {
    maybeWriteKind: SerializerWriteKind.Any,
    maybeIndentationChange: undefined,
}

function visitNode(node: Ast.TNode, state: State) {
    switch (node.kind) {
        // TPairedConstant
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression: {
            propagateWriteKind(node, node.constant, state);

            const isPairedMultiline = getIsMultiline(node.paired, state.isMultilineMap);
            if (isPairedMultiline) {
                setWorkspace(node.paired, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            else {
                setWorkspace(node.paired, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }
            break;
        }

        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            const rest = node.rest;
            propagateWriteKind(node, node.first, state);

            let restWriteKind;
            let restMaybeIndentationChange: Option<IndentationChange>;
            if (isMultiline && node.kind !== Ast.NodeKind.EqualityExpression) {
                restWriteKind = SerializerWriteKind.Indented;
                restMaybeIndentationChange = 1;
            }
            else if (rest.length === 1) {
                restWriteKind = SerializerWriteKind.PaddedLeft;
            }
            else {
                restWriteKind = SerializerWriteKind.Any;
            }

            for (const unaryExpression of node.rest) {
                setWorkspace(unaryExpression, state, {
                    maybeIndentationChange: restMaybeIndentationChange,
                    maybeWriteKind: restWriteKind,
                });
            }

            break;
        }

        // TBinOpKeyword
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.MetadataExpression: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            propagateWriteKind(node, node.left, state);

            let otherWorkspace: Workspace;
            if (isMultiline) {
                otherWorkspace = {
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            }
            else {
                otherWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft
                };
            }

            setWorkspace(node.constant, state, otherWorkspace);
            setWorkspace(node.right, state, otherWorkspace);
            break;
        }

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            visitKeyValuePair(node, state);
            break;

        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            visitWrapped(node, state);
            visitCsvArray(node.content, state, isMultiline);
            break;
        }

        case Ast.NodeKind.Csv: {
            const workspace = getWorkspace(node, state);
            const writeKind = workspace.maybeWriteKind;
            propagateWriteKind(node, node.node, state);

            if (node.maybeCommaConstant && writeKind !== SerializerWriteKind.Indented) {
                setWorkspace(node.maybeCommaConstant, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedRight,
                });
            }
            break;
        }

        case Ast.NodeKind.ErrorHandlingExpression: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            propagateWriteKind(node, node.tryConstant, state);

            const protectedIsMultiline = getIsMultiline(node.protectedExpression, state.isMultilineMap);
            if (protectedIsMultiline) {
                setWorkspace(node.protectedExpression, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            else {
                setWorkspace(node.protectedExpression, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            const maybeOtherwiseExpression = node.maybeOtherwiseExpression;
            if (maybeOtherwiseExpression) {
                let otherwiseWriteKind;
                if (isMultiline) {
                    otherwiseWriteKind = SerializerWriteKind.Indented;
                }
                else {
                    otherwiseWriteKind = SerializerWriteKind.PaddedLeft;
                }

                setWorkspace(maybeOtherwiseExpression, state, {
                    maybeWriteKind: otherwiseWriteKind,
                });
            }
            break;
        }

        // TPairedConstant override
        case Ast.NodeKind.ErrorRaisingExpression: {
            propagateWriteKind(node, node.constant, state);

            let pairedWorkspace: Workspace;
            switch (node.paired.kind) {
                case Ast.NodeKind.ListExpression:
                case Ast.NodeKind.RecordExpression:
                    pairedWorkspace = {
                        maybeWriteKind: SerializerWriteKind.PaddedLeft,
                    };
                    break;

                default:
                    const pairedIsMultiline = getIsMultiline(node.paired, state.isMultilineMap);
                    if (pairedIsMultiline) {
                        pairedWorkspace = {
                            maybeIndentationChange: 1,
                            maybeWriteKind: SerializerWriteKind.Indented,
                        };
                    }
                    else {
                        pairedWorkspace = {
                            maybeWriteKind: SerializerWriteKind.PaddedLeft,
                        };
                    }
                    break;
            }
            setWorkspace(node.paired, state, pairedWorkspace);
            break;
        }

        case Ast.NodeKind.FieldProjection: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            visitWrapped(node, state);
            visitCsvArray(node.content, state, isMultiline);
            break;
        }

        case Ast.NodeKind.FieldSelector:
            propagateWriteKind(node, node.openWrapperConstant, state);
            break;

        case Ast.NodeKind.FieldSpecification: {
            const maybeOptionalConstant = node.maybeOptionalConstant;
            if (maybePropagateWriteKind(node, maybeOptionalConstant, state)) {
                setWorkspace(node.name, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }
            else {
                propagateWriteKind(node, node.name, state);
            }

            const maybeFieldTypeSpeification = node.maybeFieldTypeSpeification;
            if (maybeFieldTypeSpeification) {
                const isMultiline = getIsMultiline(maybeFieldTypeSpeification, state.isMultilineMap);
                let typeWorkspace: Workspace;

                if (isMultiline) {
                    typeWorkspace = {
                        maybeIndentationChange: 1,
                        maybeWriteKind: SerializerWriteKind.Indented,
                    };
                }
                else {
                    typeWorkspace = {
                        maybeWriteKind: SerializerWriteKind.PaddedLeft,
                    };
                }
                setWorkspace(maybeFieldTypeSpeification, state, typeWorkspace);
            }
            break;
        }

        case Ast.NodeKind.FieldSpecificationList: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            const fields = node.content;
            visitWrapped(node, state);
            visitCsvArray(fields, state, isMultiline);

            if (node.maybeOpenRecordMarkerConstant) {
                let workspace: Workspace;
                if (isMultiline) {
                    workspace = {
                        maybeIndentationChange: 1,
                        maybeWriteKind: SerializerWriteKind.Indented,
                    };
                }
                else if (fields.length) {
                    workspace = {
                        maybeWriteKind: SerializerWriteKind.PaddedLeft,
                    };
                }
                else {
                    workspace = {
                        maybeWriteKind: SerializerWriteKind.Any,
                    };
                }
                setWorkspace(node.maybeOpenRecordMarkerConstant, state, workspace);
            }

            break;
        }

        case Ast.NodeKind.FieldTypeSpecification: {
            // can't use propagateWriteKind as I want the equalConstant on the
            // same line as the previous node (FieldParameter).
            const workspace = getWorkspace(node, state);

            // assumes SerializerWriteKind.Indented -> maybeIndentationChange === 1
            if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
                setWorkspace(node.equalConstant, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
                setWorkspace(node.fieldType, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            else {
                propagateWriteKind(node, node.equalConstant, state);
                setWorkspace(node.fieldType, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }
            break;
        }

        case Ast.NodeKind.FunctionExpression: {
            propagateWriteKind(node, node.parameters, state);

            if (node.maybeFunctionReturnType) {
                setWorkspace(node.maybeFunctionReturnType, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            setWorkspace(node.fatArrowConstant, state, {
                maybeWriteKind: SerializerWriteKind.PaddedLeft,
            });

            const expressionIsMultiline = getIsMultiline(node.expression, state.isMultilineMap);
            let expressionWorkspace: Workspace;
            if (expressionIsMultiline) {
                expressionWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                }
            }
            else {
                expressionWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                }
            }
            setWorkspace(node.expression, state, expressionWorkspace);

            break;
        }

        case Ast.NodeKind.FunctionType: {
            propagateWriteKind(node, node.functionConstant, state);

            const commonWorkspace = {
                maybeWriteKind: SerializerWriteKind.PaddedLeft,
            };
            setWorkspace(node.parameters, state, commonWorkspace);
            setWorkspace(node.functionReturnType, state, commonWorkspace);
            break;
        }

        case Ast.NodeKind.IdentifierExpression:
            if (maybePropagateWriteKind(node, node.maybeInclusiveConstant, state)) {
                setWorkspace(node.identifier, state, DefaultWorkspace);
            }
            else {
                propagateWriteKind(node, node.identifier, state);
            }
            break;

        case Ast.NodeKind.IfExpression:
            visitIfExpression(node, state);
            break;

        case Ast.NodeKind.InvokeExpression: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            visitWrapped(node, state);
            visitCsvArray(node.content, state, isMultiline);
            break;
        }

        case Ast.NodeKind.ItemAccessExpression: {
            const isMultilineMap = state.isMultilineMap;
            const isMultiline = getIsMultiline(node, isMultilineMap);
            const itemSelector = node.content;
            const itemSelectorIsMultiline = getIsMultiline(itemSelector, isMultilineMap);
            visitWrapped(node, state);

            if (isMultiline) {
                setWorkspace(itemSelector, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }

            let closeWrapperConstantWorkspace: Workspace;
            if (itemSelectorIsMultiline) {
                switch (itemSelector.kind) {
                    case Ast.NodeKind.ListExpression:
                    case Ast.NodeKind.RecordExpression:
                        closeWrapperConstantWorkspace = {
                            maybeWriteKind: SerializerWriteKind.Any,
                        };
                        break;

                    default:
                        closeWrapperConstantWorkspace = {
                            maybeWriteKind: SerializerWriteKind.Indented,
                        };
                        break;
                }
            }
            else {
                closeWrapperConstantWorkspace = {
                    maybeWriteKind: SerializerWriteKind.Any,
                };
            }
            setWorkspace(node.closeWrapperConstant, state, closeWrapperConstantWorkspace);
            break;
        }

        case Ast.NodeKind.LetExpression: {
            propagateWriteKind(node, node.letConstant, state);
            setWorkspace(node.inConstant, state, {
                maybeWriteKind: SerializerWriteKind.Indented,
            });
            setWorkspace(node.expression, state, {
                maybeIndentationChange: 1,
                maybeWriteKind: SerializerWriteKind.Indented,
            });
            visitCsvArray(node.variableList, state, true);
            break;
        }



        case Ast.NodeKind.ListType: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            visitWrapped(node, state);

            if (isMultiline) {
                setWorkspace(node.content, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            break;
        }

        case Ast.NodeKind.NotImplementedExpression:
            propagateWriteKind(node, node.ellipsisConstant, state);
            break;

        case Ast.NodeKind.Parameter: {
            if (node.maybeOptionalConstant) {
                setWorkspace(node.maybeOptionalConstant, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedRight,
                });
            }

            if (node.maybeParameterType) {
                setWorkspace(node.maybeParameterType, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            break;
        }

        case Ast.NodeKind.ParameterList:
            propagateWriteKind(node, node.openWrapperConstant, state);
            break;

        case Ast.NodeKind.ParenthesizedExpression: {
            const isMultiline = getIsMultiline(node, state.isMultilineMap);
            visitWrapped(node, state);

            if (isMultiline) {
                setWorkspace(node.content, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            break;
        }

        case Ast.NodeKind.PrimitiveType:
            propagateWriteKind(node, node.primitiveType, state);
            break;

        case Ast.NodeKind.RecordType: {
            const workspace = getWorkspace(node, state);
            setWorkspace(node.fields, state, workspace);
            break;
        }

        case Ast.NodeKind.RecursivePrimaryExpression:
            propagateWriteKind(node, node.head, state);
            break;

        case Ast.NodeKind.TableType: {
            propagateWriteKind(node, node.tableConstant, state);
            const rowType = node.rowType;
            const rowTypeIsMultiline = getIsMultiline(rowType, state.isMultilineMap);

            let rowTypeWorkspace: Workspace;
            if (rowTypeIsMultiline) {
                rowTypeWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            }
            else {
                rowTypeWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            }
            setWorkspace(rowType, state, rowTypeWorkspace);
            break;
        }

        case Ast.NodeKind.Section: {
            const isMultilineMap = state.isMultilineMap;

            let sectionConstantWriteKind = SerializerWriteKind.Any;
            const maybeLiteralAttributes = node.maybeLiteralAttributes;
            if (maybeLiteralAttributes) {
                if (getIsMultiline(maybeLiteralAttributes, isMultilineMap)) {
                    sectionConstantWriteKind = SerializerWriteKind.Indented;
                }
                else {
                    sectionConstantWriteKind = SerializerWriteKind.PaddedLeft;
                }
            }
            setWorkspace(node.sectionConstant, state, {
                maybeWriteKind: sectionConstantWriteKind,
            });

            const maybeName = node.maybeName;
            if (maybeName) {
                setWorkspace(maybeName, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            let lastMember;
            for (const member of node.sectionMembers) {
                let memberWriteKind = SerializerWriteKind.DoubleNewline;

                if (lastMember && isSectionMemeberSimilarScope(member, lastMember)) {
                    memberWriteKind = SerializerWriteKind.Indented;
                }

                setWorkspace(member, state, {
                    maybeWriteKind: memberWriteKind,
                });

                lastMember = member;
            }
            break;
        }

        case Ast.NodeKind.SectionMember: {
            const isMultilineMap = state.isMultilineMap;
            let maybeSharedConstantWriteKind;
            let isNameExpressionPairWorkspaceSet = false;

            if (node.maybeLiteralAttributes) {
                propagateWriteKind(node, node.maybeLiteralAttributes, state);
                if (getIsMultiline(node.maybeLiteralAttributes, isMultilineMap)) {
                    maybeSharedConstantWriteKind = SerializerWriteKind.Indented;
                }
                else {
                    maybeSharedConstantWriteKind = SerializerWriteKind.PaddedLeft;
                }
            }
            else if (node.maybeSharedConstant) {
                propagateWriteKind(node, node.maybeSharedConstant, state);
            }
            else {
                propagateWriteKind(node, node.namePairedExpression, state);
                isNameExpressionPairWorkspaceSet = true;
            }

            if (node.maybeSharedConstant && maybeSharedConstantWriteKind) {
                setWorkspace(node.maybeSharedConstant, state, {
                    maybeWriteKind: maybeSharedConstantWriteKind,
                })
            }

            if (!isNameExpressionPairWorkspaceSet) {
                let isNameExpressionPairIndented = false;
                if (node.maybeSharedConstant) {
                    if (getIsMultiline(node.maybeSharedConstant, isMultilineMap)) {
                        isNameExpressionPairIndented = true;
                    }
                }
                else if (node.maybeLiteralAttributes) {
                    if (getIsMultiline(node.maybeLiteralAttributes, isMultilineMap)) {
                        isNameExpressionPairIndented = true;
                    }
                }

                let writeKind;
                if (isNameExpressionPairIndented) {
                    writeKind = SerializerWriteKind.Indented;
                }
                else {
                    writeKind = SerializerWriteKind.PaddedLeft;
                }
                setWorkspace(node.namePairedExpression, state, {
                    maybeWriteKind: writeKind,
                });
            }
            break;
        }

        // TPairedConstant overload
        case Ast.NodeKind.TypePrimaryType: {
            propagateWriteKind(node, node.constant, state);

            const paired = node.paired;
            const pairedIsMultiline = getIsMultiline(paired, state.isMultilineMap);
            let pairedWorkspace: Workspace;
            if (skipPrimaryTypeIndentation(paired)) {
                pairedWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                }
            }
            else if (pairedIsMultiline) {
                pairedWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            }
            else {
                pairedWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            }
            setWorkspace(paired, state, pairedWorkspace);
            break;
        }

        case Ast.NodeKind.UnaryExpression:
            propagateWriteKind(node, node.expressions[0], state);
            break;

        case Ast.NodeKind.UnaryExpressionHelper: {
            const workspace = getWorkspace(node, state);
            let constantWriteKind = workspace.maybeWriteKind;

            if (node.inBinaryExpression) {
                if (workspace.maybeWriteKind !== SerializerWriteKind.Indented) {
                    constantWriteKind = SerializerWriteKind.PaddedLeft;
                }
                setWorkspace(node.node, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            maybeSetIndentationChange(node, state, workspace.maybeIndentationChange);
            setWorkspace(node.operatorConstant, state, {
                maybeWriteKind: constantWriteKind,
            });
            break;
        }

        // terminal nodes.
        // if a parent gave the terminal node a workspace it assigns writeKind.
        // indentationType may get overwritten if the terminal node has a comment attached.
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.LiteralExpression: {
            const cacheKey = node.tokenRange.hash;
            const workspace = getWorkspace(node, state)
            maybeSetIndentationChange(node, state, workspace.maybeIndentationChange);

            let maybeWriteKind = workspace.maybeWriteKind;
            maybeWriteKind = visitComments(node, state, maybeWriteKind);
            if (!maybeWriteKind) {
                const details = {
                    node,
                    maybeWriteKind: maybeWriteKind,
                };
                throw new CommonError.InvariantError("maybeWriteKind should be truthy", details);
            }

            state.result.writeKind[cacheKey] = maybeWriteKind;
            break;
        }

        default:
            isNever(node);
    }
}

function getWorkspace(node: Ast.TNode, state: State, fallback = DefaultWorkspace): Workspace {
    const cacheKey = node.tokenRange.hash;
    const maybeWorkspace: Option<Workspace> = state.workspaceMap[cacheKey];

    if (maybeWorkspace !== undefined) {
        return maybeWorkspace;
    }
    else {
        return fallback;
    }
}

function setWorkspace(node: Ast.TNode, state: State, workspace: Workspace) {
    const cacheKey = node.tokenRange.hash;
    state.workspaceMap[cacheKey] = workspace;
}

// sets indentationChange for the parent using the parent's Workspace,
// then propagates the writeKind to firstChild by setting its Workspace.
function propagateWriteKind(parent: Ast.TNode, firstChild: Ast.TNode, state: State) {
    const workspace = getWorkspace(parent, state);
    maybeSetIndentationChange(parent, state, workspace.maybeIndentationChange);

    const maybeWriteKind = workspace.maybeWriteKind;
    if (maybeWriteKind) {
        setWorkspace(firstChild, state, {
            maybeWriteKind: maybeWriteKind,
        });
    }
}

function maybePropagateWriteKind(parent: Ast.TNode, maybeFirstChild: Option<Ast.TNode>, state: State): boolean {
    if (maybeFirstChild) {
        propagateWriteKind(parent, maybeFirstChild, state);
        return true;
    }
    else {
        return false;
    }
}

function maybeSetIndentationChange(node: Ast.TNode, state: State, maybeIndentationChange: Option<IndentationChange>) {
    if (maybeIndentationChange) {
        const cacheKey = node.tokenRange.hash;
        state.result.indentationChange[cacheKey] = maybeIndentationChange;
    }
}

// serves three purposes:
//  * propagates the TNode's writeKind to the first comment
//  * assigns writeKind for all comments attached to the TNode
//  * conditionally changes the TNode's writeKind based on the last comment's writeKind
//
// for example if maybeWriteKind === PaddedLeft and the TNode has two line comments:
//  * the first comment is set to PaddedLeft (from maybeWriteKind)
//  * the second comment is set to Indented (default for comment with newline)
//  * the TNode is set to Indented (last comment contains a newline)
function visitComments(
    node: Ast.TNode,
    state: State,
    maybeWriteKind: Option<SerializerWriteKind>
): Option<SerializerWriteKind> {
    const cacheKey = node.tokenRange.hash;
    const maybeComments = state.commentCollectionMap[cacheKey];
    if (!maybeComments) {
        return maybeWriteKind;
    }

    const commentParameters: SerializeCommentParameter[] = [];
    const comments = maybeComments.prefixedComments;

    const numComments = comments.length;
    if (!numComments) {
        return maybeWriteKind;
    }

    for (let index = 0; index < numComments; index++) {
        const comment: TComment = comments[index];
        const previousComment: Option<TComment> = comments[index - 1];

        let writeKind;
        if (index === 0) {
            writeKind = maybeWriteKind || SerializerWriteKind.Any;
        }
        else if (comment.containsNewline) {
            writeKind = SerializerWriteKind.Indented;
        }
        else if (previousComment && previousComment.containsNewline) {
            writeKind = SerializerWriteKind.Indented;
        }
        else {
            writeKind = SerializerWriteKind.Any;
        }

        commentParameters.push({
            literal: comment.data,
            writeKind,
        });
    }

    state.result.comments[cacheKey] = commentParameters;

    const lastComment = comments[comments.length - 1];
    if (lastComment.containsNewline) {
        maybeWriteKind = SerializerWriteKind.Indented;
    }
    else {
        maybeWriteKind = SerializerWriteKind.PaddedLeft;
    }

    return maybeWriteKind;
}

function visitKeyValuePair(node: Ast.TKeyValuePair, state: State) {
    const isMultilineMap = state.isMultilineMap;
    const equalConstantIsMultiline = getIsMultiline(node.equalConstant, isMultilineMap);
    const valueIsMultiline = getIsMultiline(node.value, isMultilineMap);
    propagateWriteKind(node, node.key, state);

    let equalWorkspace: Workspace;
    if (equalConstantIsMultiline) {
        equalWorkspace = { maybeWriteKind: SerializerWriteKind.Indented };
    }
    else {
        equalWorkspace = { maybeWriteKind: SerializerWriteKind.PaddedLeft };
    }
    setWorkspace(node.equalConstant, state, equalWorkspace);

    let valueWorkspace: Workspace;
    if (valueIsMultiline) {
        valueWorkspace = {
            maybeIndentationChange: 1,
            maybeWriteKind: SerializerWriteKind.Indented,
        };
    }
    else {
        valueWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        }
    }
    setWorkspace(node.value, state, valueWorkspace);
}

function visitCsvArray(csvs: ReadonlyArray<Ast.TCsv>, state: State, isMultiline: boolean) {
    let csvWriteKind;
    let maybeCsvIndentationChange: Option<IndentationChange>;
    if (isMultiline) {
        csvWriteKind = SerializerWriteKind.Indented;
        maybeCsvIndentationChange = 1;
    }
    else {
        csvWriteKind = SerializerWriteKind.Any;
    }

    for (const csv of csvs) {
        setWorkspace(csv, state, {
            maybeWriteKind: csvWriteKind,
            maybeIndentationChange: maybeCsvIndentationChange,
        });
    }
}

function visitWrapped(wrapped: Ast.TWrapped, state: State) {
    const isMultiline = getIsMultiline(wrapped, state.isMultilineMap);
    // not const as it's conditionally overwritten if SerializerWriteKind.Indented
    let workspace = getWorkspace(wrapped, state);

    if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
        let writeKind = getWrapperOpenWriteKind(wrapped, state);

        if (writeKind !== SerializerWriteKind.Indented) {
            workspace = {
                maybeIndentationChange: undefined,
                maybeWriteKind: writeKind,
            }
        }
    }

    setWorkspace(wrapped, state, workspace);
    propagateWriteKind(wrapped, wrapped.openWrapperConstant, state);

    if (isMultiline) {
        setWorkspace(wrapped.closeWrapperConstant, state, {
            maybeWriteKind: SerializerWriteKind.Indented,
        });
    }
}

function visitIfExpression(node: Ast.IfExpression, state: State) {
    propagateWriteKind(node, node.ifConstant, state);

    const conditionIsMultiline = getIsMultiline(node.condition, state.isMultilineMap);

    let conditionWorkspace: Workspace;
    let thenConstantWorkspace: Workspace;
    if (conditionIsMultiline) {
        conditionWorkspace = {
            maybeIndentationChange: 1,
            maybeWriteKind: SerializerWriteKind.Indented,
        };
        thenConstantWorkspace = {
            maybeWriteKind: SerializerWriteKind.Indented,
        }
    }
    else {
        conditionWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        };
        thenConstantWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        }
    }
    setWorkspace(node.condition, state, conditionWorkspace);
    setWorkspace(node.thenConstant, state, thenConstantWorkspace);
    setWorkspace(node.trueExpression, state, {
        maybeIndentationChange: 1,
        maybeWriteKind: SerializerWriteKind.Indented,
    });

    const falseExpression = node.falseExpression;
    let falseExpressionWorkspace: Workspace;
    if (falseExpression.kind === Ast.NodeKind.IfExpression) {
        falseExpressionWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        };
    }
    else {
        falseExpressionWorkspace = {
            maybeIndentationChange: 1,
            maybeWriteKind: SerializerWriteKind.Indented,
        };
    }
    setWorkspace(node.elseConstant, state, {
        maybeWriteKind: SerializerWriteKind.Indented,
    });
    setWorkspace(falseExpression, state, falseExpressionWorkspace);
}

function getWrapperOpenWriteKind(wrapped: Ast.TWrapped, state: State): SerializerWriteKind {
    // an open constant is multiline iff it is has a multiline comment
    const openIsMultiline = getIsMultiline(wrapped.openWrapperConstant, state.isMultilineMap);
    if (openIsMultiline) {
        return SerializerWriteKind.Indented;
    }

    const parentMap = state.parentMap;
    let maybeParent = maybeGetParent(wrapped, parentMap);
    if (maybeParent && maybeParent.kind === Ast.NodeKind.Csv) {
        maybeParent = maybeGetParent(maybeParent, parentMap);
    }

    if (!maybeParent) {
        return SerializerWriteKind.Indented;
    }

    switch (maybeParent.kind) {
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
        case Ast.NodeKind.ListType:
        case Ast.NodeKind.RecordType:
        case Ast.NodeKind.TableType:
        case Ast.NodeKind.TypePrimaryType:
            return SerializerWriteKind.PaddedLeft;

        case Ast.NodeKind.ItemAccessExpression:
            return SerializerWriteKind.Any;

        default:
            return SerializerWriteKind.Indented;
    }
}

function skipPrimaryTypeIndentation(node: Ast.TPrimaryType): boolean {
    switch (node.kind) {
        case Ast.NodeKind.FunctionType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.TableType:
            return true;

        case Ast.NodeKind.ListType:
        case Ast.NodeKind.PrimitiveType:
        case Ast.NodeKind.RecordType:
            return false;

        default:
            isNever(node);
    }

    return false;
}

// by default sections are two newlines apart from one another.
// like named sections (ex. Foo.Alpha, Foo.Bravo) should be placed one newline apart.
function isSectionMemeberSimilarScope(left: Ast.SectionMember, right: Ast.SectionMember): boolean {
    const leftName = left.namePairedExpression.key;
    const leftScope = leftName.literal.split(".");
    const rightName = right.namePairedExpression.key;
    const rightScope = rightName.literal.split(".");

    return leftScope[0] === rightScope[0];
}
