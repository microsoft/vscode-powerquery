// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, CommonError, isNever, NodeIdMap, Option, TComment, Traverse } from "@microsoft/powerquery-parser";
import { CommentCollection, CommentCollectionMap } from "./comment";
import { maybeGetParent } from "./common";
import { expectGetIsMultiline, IsMultilineMap } from "./isMultiline/common";

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
    readonly indentationChange: Map<number, IndentationChange>;
    readonly writeKind: Map<number, SerializerWriteKind>;
    readonly comments: Map<number, ReadonlyArray<SerializeCommentParameter>>;
}

export interface SerializeCommentParameter {
    readonly literal: string;
    readonly writeKind: SerializerWriteKind;
}

export function tryTraverse(
    ast: Ast.TNode,
    nodeIdMapCollection: NodeIdMap.Collection,
    commentCollectionMap: CommentCollectionMap,
    isMultilineMap: IsMultilineMap,
): Traverse.TriedTraverse<SerializerParameterMap> {
    const state: State = {
        result: {
            writeKind: new Map(),
            indentationChange: new Map(),
            comments: new Map(),
        },
        nodeIdMapCollection,
        commentCollectionMap,
        isMultilineMap,
        workspaceMap: new Map(),
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

export function getSerializerWriteKind(
    node: Ast.TNode,
    serializerParametersMap: SerializerParameterMap,
): SerializerWriteKind {
    const maybeWriteKind: Option<SerializerWriteKind> = serializerParametersMap.writeKind.get(node.id);
    if (maybeWriteKind) {
        return maybeWriteKind;
    } else {
        const details: {} = { node };
        throw new CommonError.InvariantError("expected node to be in SerializerParameterMap.writeKind", details);
    }
}

interface State extends Traverse.IState<SerializerParameterMap> {
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly commentCollectionMap: CommentCollectionMap;
    readonly isMultilineMap: IsMultilineMap;
    readonly workspaceMap: Map<number, Workspace>;
}

// temporary storage used during traversal
interface Workspace {
    readonly maybeIndentationChange?: IndentationChange;
    readonly maybeWriteKind?: SerializerWriteKind;
}

const DefaultWorkspace: Workspace = {
    maybeWriteKind: SerializerWriteKind.Any,
    maybeIndentationChange: undefined,
};

function visitNode(node: Ast.TNode, state: State): void {
    switch (node.kind) {
        case Ast.NodeKind.ArrayWrapper: {
            const parent: Ast.TNode = NodeIdMap.expectParentAstNode(state.nodeIdMapCollection, node.id);

            if (parent.kind === Ast.NodeKind.Section) {
                visitArrayWrapperForSectionMembers(parent.sectionMembers, state);
            } else {
                visitArrayWrapper(node, state);
            }

            break;
        }

        // TPairedConstant
        case Ast.NodeKind.AsNullablePrimitiveType:
        case Ast.NodeKind.AsType:
        case Ast.NodeKind.EachExpression:
        case Ast.NodeKind.IsNullablePrimitiveType:
        case Ast.NodeKind.NullablePrimitiveType:
        case Ast.NodeKind.NullableType:
        case Ast.NodeKind.OtherwiseExpression: {
            propagateWriteKind(node, node.constant, state);

            const isPairedMultiline: boolean = expectGetIsMultiline(node.paired, state.isMultilineMap);
            if (isPairedMultiline) {
                setWorkspace(node.paired, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            } else {
                setWorkspace(node.paired, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }
            break;
        }

        // TBinOpExpression
        case Ast.NodeKind.ArithmeticExpression:
        case Ast.NodeKind.AsExpression:
        case Ast.NodeKind.EqualityExpression:
        case Ast.NodeKind.IsExpression:
        case Ast.NodeKind.LogicalExpression:
        case Ast.NodeKind.RelationalExpression: {
            propagateWriteKind(node, node.left, state);

            // A continuation of multiline TBinOpExpression
            if (isInMultilineTBinOpExpression(state, node)) {
                propagateWriteKind(node, node.left, state);
                setWorkspace(node.operatorConstant, state, { maybeWriteKind: SerializerWriteKind.Indented });
                setWorkspace(node.right, state, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }
            // The head of multiline TBinOpExpression
            else if (expectGetIsMultiline(node, state.isMultilineMap)) {
                setWorkspace(node.left, state, {
                    ...getWorkspace(node, state),
                    maybeIndentationChange: 1,
                });
                setWorkspace(node.operatorConstant, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
                setWorkspace(node.right, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }
            // Either the head of a non-multiline TBinOpExpression,
            // or a continuation of a non-multiline TBinOpExpression.
            else {
                propagateWriteKind(node, node.left, state);
                setWorkspace(node.operatorConstant, state, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
                setWorkspace(node.right, state, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }

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
        case Ast.NodeKind.RecordLiteral:
            visitWrapped(node, state);
            break;

        case Ast.NodeKind.Csv: {
            const workspace: Workspace = getWorkspace(node, state);
            const maybeWriteKind: Option<SerializerWriteKind> = workspace.maybeWriteKind;
            propagateWriteKind(node, node.node, state);

            if (node.maybeCommaConstant && maybeWriteKind !== SerializerWriteKind.Indented) {
                setWorkspace(node.maybeCommaConstant, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedRight,
                });
            }
            break;
        }

        case Ast.NodeKind.ErrorHandlingExpression: {
            const isMultiline: boolean = expectGetIsMultiline(node, state.isMultilineMap);
            propagateWriteKind(node, node.tryConstant, state);

            const protectedIsMultiline: boolean = expectGetIsMultiline(node.protectedExpression, state.isMultilineMap);
            if (protectedIsMultiline) {
                setWorkspace(node.protectedExpression, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            } else {
                setWorkspace(node.protectedExpression, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            const maybeOtherwiseExpression: Option<Ast.OtherwiseExpression> = node.maybeOtherwiseExpression;
            if (maybeOtherwiseExpression) {
                let otherwiseWriteKind: SerializerWriteKind;
                if (isMultiline) {
                    otherwiseWriteKind = SerializerWriteKind.Indented;
                } else {
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
                    const pairedIsMultiline: boolean = expectGetIsMultiline(node.paired, state.isMultilineMap);
                    if (pairedIsMultiline) {
                        pairedWorkspace = {
                            maybeIndentationChange: 1,
                            maybeWriteKind: SerializerWriteKind.Indented,
                        };
                    } else {
                        pairedWorkspace = {
                            maybeWriteKind: SerializerWriteKind.PaddedLeft,
                        };
                    }
                    break;
            }
            setWorkspace(node.paired, state, pairedWorkspace);
            break;
        }

        case Ast.NodeKind.FieldProjection:
            visitWrapped(node, state);
            break;

        case Ast.NodeKind.FieldSelector:
            propagateWriteKind(node, node.openWrapperConstant, state);
            break;

        case Ast.NodeKind.FieldSpecification: {
            const maybeOptionalConstant: Option<Ast.Constant> = node.maybeOptionalConstant;
            if (maybePropagateWriteKind(node, maybeOptionalConstant, state)) {
                setWorkspace(node.name, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            } else {
                propagateWriteKind(node, node.name, state);
            }

            const maybeFieldTypeSpeification: Option<Ast.FieldTypeSpecification> = node.maybeFieldTypeSpeification;
            if (maybeFieldTypeSpeification) {
                const isMultiline: boolean = expectGetIsMultiline(maybeFieldTypeSpeification, state.isMultilineMap);
                let typeWorkspace: Workspace;

                if (isMultiline) {
                    typeWorkspace = {
                        maybeIndentationChange: 1,
                        maybeWriteKind: SerializerWriteKind.Indented,
                    };
                } else {
                    typeWorkspace = {
                        maybeWriteKind: SerializerWriteKind.PaddedLeft,
                    };
                }
                setWorkspace(maybeFieldTypeSpeification, state, typeWorkspace);
            }
            break;
        }

        case Ast.NodeKind.FieldSpecificationList: {
            const isMultiline: boolean = expectGetIsMultiline(node, state.isMultilineMap);
            const fieldsArray: Ast.IArrayWrapper<Ast.ICsv<Ast.FieldSpecification>> = node.content;
            visitWrapped(node, state);

            if (node.maybeOpenRecordMarkerConstant) {
                const openRecordMarkerConstant: Ast.Constant = node.maybeOpenRecordMarkerConstant;
                let workspace: Workspace;

                if (isMultiline) {
                    workspace = {
                        maybeIndentationChange: 1,
                        maybeWriteKind: SerializerWriteKind.Indented,
                    };
                } else if (fieldsArray.elements.length) {
                    workspace = {
                        maybeWriteKind: SerializerWriteKind.PaddedLeft,
                    };
                } else {
                    workspace = {
                        maybeWriteKind: SerializerWriteKind.Any,
                    };
                }
                setWorkspace(openRecordMarkerConstant, state, workspace);
            }

            break;
        }

        case Ast.NodeKind.FieldTypeSpecification: {
            // can't use propagateWriteKind as I want the equalConstant on the
            // same line as the previous node (FieldParameter).
            const workspace: Workspace = getWorkspace(node, state);

            // assumes SerializerWriteKind.Indented -> maybeIndentationChange === 1
            if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
                setWorkspace(node.equalConstant, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
                setWorkspace(node.fieldType, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            } else {
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

            const expressionIsMultiline: boolean = expectGetIsMultiline(node.expression, state.isMultilineMap);
            let expressionWorkspace: Workspace;
            if (expressionIsMultiline) {
                expressionWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            } else {
                expressionWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            }
            setWorkspace(node.expression, state, expressionWorkspace);

            break;
        }

        case Ast.NodeKind.FunctionType: {
            propagateWriteKind(node, node.functionConstant, state);

            const commonWorkspace: Workspace = {
                maybeWriteKind: SerializerWriteKind.PaddedLeft,
            };
            setWorkspace(node.parameters, state, commonWorkspace);
            setWorkspace(node.functionReturnType, state, commonWorkspace);
            break;
        }

        case Ast.NodeKind.IdentifierExpression:
            if (maybePropagateWriteKind(node, node.maybeInclusiveConstant, state)) {
                setWorkspace(node.identifier, state, DefaultWorkspace);
            } else {
                propagateWriteKind(node, node.identifier, state);
            }
            break;

        case Ast.NodeKind.IfExpression:
            visitIfExpression(node, state);
            break;

        case Ast.NodeKind.InvokeExpression:
            visitWrapped(node, state);
            break;

        case Ast.NodeKind.ItemAccessExpression: {
            const isMultilineMap: IsMultilineMap = state.isMultilineMap;
            const isMultiline: boolean = expectGetIsMultiline(node, isMultilineMap);
            const itemSelector: Ast.TExpression = node.content;
            const itemSelectorIsMultiline: boolean = expectGetIsMultiline(itemSelector, isMultilineMap);
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
            } else {
                closeWrapperConstantWorkspace = {
                    maybeWriteKind: SerializerWriteKind.Any,
                };
            }
            setWorkspace(node.closeWrapperConstant, state, closeWrapperConstantWorkspace);
            break;
        }

        case Ast.NodeKind.LetExpression:
            propagateWriteKind(node, node.letConstant, state);
            setWorkspace(node.inConstant, state, {
                maybeWriteKind: SerializerWriteKind.Indented,
            });
            setWorkspace(node.expression, state, {
                maybeIndentationChange: 1,
                maybeWriteKind: SerializerWriteKind.Indented,
            });
            break;

        case Ast.NodeKind.ListType: {
            const isMultiline: boolean = expectGetIsMultiline(node, state.isMultilineMap);
            visitWrapped(node, state);

            if (isMultiline) {
                setWorkspace(node.content, state, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            break;
        }

        case Ast.NodeKind.MetadataExpression: {
            const isMultiline: boolean = expectGetIsMultiline(node, state.isMultilineMap);
            propagateWriteKind(node, node.left, state);

            let otherWorkspace: Workspace;
            if (isMultiline) {
                otherWorkspace = {
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            } else {
                otherWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            }

            setWorkspace(node.constant, state, otherWorkspace);
            setWorkspace(node.right, state, otherWorkspace);
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
            const isMultiline: boolean = expectGetIsMultiline(node, state.isMultilineMap);
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

        case Ast.NodeKind.RangeExpression:
            throw new Error(`todo`);

        case Ast.NodeKind.RecordType: {
            const workspace: Workspace = getWorkspace(node, state);
            setWorkspace(node.fields, state, workspace);
            break;
        }

        case Ast.NodeKind.RecursivePrimaryExpression:
            propagateWriteKind(node, node.head, state);
            break;

        case Ast.NodeKind.TableType: {
            propagateWriteKind(node, node.tableConstant, state);
            const rowType: Ast.FieldSpecificationList | Ast.TPrimaryExpression = node.rowType;
            const rowTypeIsMultiline: boolean = expectGetIsMultiline(rowType, state.isMultilineMap);

            let rowTypeWorkspace: Workspace;
            if (rowTypeIsMultiline) {
                rowTypeWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            } else {
                rowTypeWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            }
            setWorkspace(rowType, state, rowTypeWorkspace);
            break;
        }

        case Ast.NodeKind.Section: {
            const isMultilineMap: IsMultilineMap = state.isMultilineMap;

            let sectionConstantWriteKind: SerializerWriteKind = SerializerWriteKind.Any;
            const maybeLiteralAttributes: Option<Ast.RecordLiteral> = node.maybeLiteralAttributes;
            if (maybeLiteralAttributes) {
                if (expectGetIsMultiline(maybeLiteralAttributes, isMultilineMap)) {
                    sectionConstantWriteKind = SerializerWriteKind.Indented;
                } else {
                    sectionConstantWriteKind = SerializerWriteKind.PaddedLeft;
                }
            }
            setWorkspace(node.sectionConstant, state, {
                maybeWriteKind: sectionConstantWriteKind,
            });

            const maybeName: Option<Ast.Identifier> = node.maybeName;
            if (maybeName) {
                setWorkspace(maybeName, state, {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                });
            }

            break;
        }

        case Ast.NodeKind.SectionMember: {
            const isMultilineMap: IsMultilineMap = state.isMultilineMap;
            let maybeSharedConstantWriteKind: Option<SerializerWriteKind>;
            let isNameExpressionPairWorkspaceSet: boolean = false;

            if (node.maybeLiteralAttributes) {
                propagateWriteKind(node, node.maybeLiteralAttributes, state);
                if (expectGetIsMultiline(node.maybeLiteralAttributes, isMultilineMap)) {
                    maybeSharedConstantWriteKind = SerializerWriteKind.Indented;
                } else {
                    maybeSharedConstantWriteKind = SerializerWriteKind.PaddedLeft;
                }
            } else if (node.maybeSharedConstant) {
                propagateWriteKind(node, node.maybeSharedConstant, state);
            } else {
                propagateWriteKind(node, node.namePairedExpression, state);
                isNameExpressionPairWorkspaceSet = true;
            }

            if (node.maybeSharedConstant && maybeSharedConstantWriteKind) {
                setWorkspace(node.maybeSharedConstant, state, {
                    maybeWriteKind: maybeSharedConstantWriteKind,
                });
            }

            if (!isNameExpressionPairWorkspaceSet) {
                let isNameExpressionPairIndented: boolean = false;
                if (node.maybeSharedConstant) {
                    if (expectGetIsMultiline(node.maybeSharedConstant, isMultilineMap)) {
                        isNameExpressionPairIndented = true;
                    }
                } else if (node.maybeLiteralAttributes) {
                    if (expectGetIsMultiline(node.maybeLiteralAttributes, isMultilineMap)) {
                        isNameExpressionPairIndented = true;
                    }
                }

                let writeKind: SerializerWriteKind;
                if (isNameExpressionPairIndented) {
                    writeKind = SerializerWriteKind.Indented;
                } else {
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

            const paired: Ast.TPrimaryType = node.paired;
            const pairedIsMultiline: boolean = expectGetIsMultiline(paired, state.isMultilineMap);
            let pairedWorkspace: Workspace;
            if (skipPrimaryTypeIndentation(paired)) {
                pairedWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            } else if (pairedIsMultiline) {
                pairedWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            } else {
                pairedWorkspace = {
                    maybeWriteKind: SerializerWriteKind.PaddedLeft,
                };
            }
            setWorkspace(paired, state, pairedWorkspace);
            break;
        }

        case Ast.NodeKind.UnaryExpression:
            propagateWriteKind(node, node.operators.elements[0], state);
            break;

        // Leaf nodes.
        // If a parent gave the leaf node a workspace it assigns indentationChange,
        // while writeType can be overwritten if the leaf node has a multiline comment attached.
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.LiteralExpression: {
            const cacheKey: number = node.id;
            const workspace: Workspace = getWorkspace(node, state);
            maybeSetIndentationChange(node, state, workspace.maybeIndentationChange);

            let maybeWriteKind: Option<SerializerWriteKind> = workspace.maybeWriteKind;
            maybeWriteKind = visitComments(node, state, maybeWriteKind);
            if (!maybeWriteKind) {
                const details: {} = {
                    node,
                    maybeWriteKind: maybeWriteKind,
                };
                throw new CommonError.InvariantError("maybeWriteKind should be truthy", details);
            }

            state.result.writeKind.set(cacheKey, maybeWriteKind);
            break;
        }

        default:
            isNever(node);
    }
}

function getWorkspace(node: Ast.TNode, state: State, fallback: Workspace = DefaultWorkspace): Workspace {
    const maybeWorkspace: Option<Workspace> = state.workspaceMap.get(node.id);

    if (maybeWorkspace !== undefined) {
        return maybeWorkspace;
    } else {
        return fallback;
    }
}

function setWorkspace(node: Ast.TNode, state: State, workspace: Workspace): void {
    state.workspaceMap.set(node.id, workspace);
}

// sets indentationChange for the parent using the parent's Workspace,
// then propagates the writeKind to firstChild by setting its Workspace.
function propagateWriteKind(parent: Ast.TNode, firstChild: Ast.TNode, state: State): void {
    const workspace: Workspace = getWorkspace(parent, state);
    maybeSetIndentationChange(parent, state, workspace.maybeIndentationChange);

    const maybeWriteKind: Option<SerializerWriteKind> = workspace.maybeWriteKind;
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
    } else {
        return false;
    }
}

function maybeSetIndentationChange(
    node: Ast.TNode,
    state: State,
    maybeIndentationChange: Option<IndentationChange>,
): void {
    if (maybeIndentationChange) {
        state.result.indentationChange.set(node.id, maybeIndentationChange);
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
    maybeWriteKind: Option<SerializerWriteKind>,
): Option<SerializerWriteKind> {
    const cacheKey: number = node.id;
    const maybeComments: Option<CommentCollection> = state.commentCollectionMap.get(cacheKey);
    if (!maybeComments) {
        return maybeWriteKind;
    }

    const commentParameters: SerializeCommentParameter[] = [];
    const comments: ReadonlyArray<TComment> = maybeComments.prefixedComments;

    const numComments: number = comments.length;
    if (!numComments) {
        return maybeWriteKind;
    }

    for (let index: number = 0; index < numComments; index += 1) {
        const comment: TComment = comments[index];
        const previousComment: Option<TComment> = comments[index - 1];

        let writeKind: SerializerWriteKind;
        if (index === 0) {
            writeKind = maybeWriteKind || SerializerWriteKind.Any;
        } else if (comment.containsNewline) {
            writeKind = SerializerWriteKind.Indented;
        } else if (previousComment && previousComment.containsNewline) {
            writeKind = SerializerWriteKind.Indented;
        } else {
            writeKind = SerializerWriteKind.Any;
        }

        commentParameters.push({
            literal: comment.data,
            writeKind,
        });
    }

    state.result.comments.set(cacheKey, commentParameters);

    const lastComment: TComment = comments[comments.length - 1];
    if (lastComment.containsNewline) {
        maybeWriteKind = SerializerWriteKind.Indented;
    } else {
        maybeWriteKind = SerializerWriteKind.PaddedLeft;
    }

    return maybeWriteKind;
}

function visitKeyValuePair(node: Ast.TKeyValuePair, state: State): void {
    const isMultilineMap: IsMultilineMap = state.isMultilineMap;
    const equalConstantIsMultiline: boolean = expectGetIsMultiline(node.equalConstant, isMultilineMap);
    const valueIsMultiline: boolean = expectGetIsMultiline(node.value, isMultilineMap);
    propagateWriteKind(node, node.key, state);

    let equalWorkspace: Workspace;
    if (equalConstantIsMultiline) {
        equalWorkspace = { maybeWriteKind: SerializerWriteKind.Indented };
    } else {
        equalWorkspace = { maybeWriteKind: SerializerWriteKind.PaddedLeft };
    }
    setWorkspace(node.equalConstant, state, equalWorkspace);

    let valueWorkspace: Workspace;
    if (valueIsMultiline) {
        valueWorkspace = {
            maybeIndentationChange: 1,
            maybeWriteKind: SerializerWriteKind.Indented,
        };
    } else {
        valueWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        };
    }
    setWorkspace(node.value, state, valueWorkspace);
}

function visitArrayWrapper(node: Ast.TArrayWrapper, state: State): void {
    const isMultiline: boolean = expectGetIsMultiline(node, state.isMultilineMap);

    let maybeWriteKind: Option<SerializerWriteKind>;
    let maybeIndentationChange: Option<IndentationChange>;
    if (isMultiline) {
        maybeWriteKind = SerializerWriteKind.Indented;
        maybeIndentationChange = 1;
    } else {
        maybeWriteKind = SerializerWriteKind.Any;
    }

    for (const element of node.elements) {
        setWorkspace(element, state, {
            maybeWriteKind,
            maybeIndentationChange,
        });
    }
}

function visitArrayWrapperForSectionMembers(node: Ast.IArrayWrapper<Ast.SectionMember>, state: State): void {
    let maybePreviousSectionMember: Option<Ast.SectionMember>;
    for (const member of node.elements) {
        if (member.kind !== Ast.NodeKind.SectionMember) {
            const details: {} = { nodeKind: member.kind };
            throw new CommonError.InvariantError(`expected sectionMember`, details);
        }

        let memberWriteKind: SerializerWriteKind = SerializerWriteKind.DoubleNewline;

        if (maybePreviousSectionMember && isSectionMemeberSimilarScope(member, maybePreviousSectionMember)) {
            memberWriteKind = SerializerWriteKind.Indented;
        }

        setWorkspace(member, state, {
            maybeWriteKind: memberWriteKind,
        });

        maybePreviousSectionMember = member;
    }
}

function visitIfExpression(node: Ast.IfExpression, state: State): void {
    propagateWriteKind(node, node.ifConstant, state);

    const conditionIsMultiline: boolean = expectGetIsMultiline(node.condition, state.isMultilineMap);

    let conditionWorkspace: Workspace;
    let thenConstantWorkspace: Workspace;
    if (conditionIsMultiline) {
        conditionWorkspace = {
            maybeIndentationChange: 1,
            maybeWriteKind: SerializerWriteKind.Indented,
        };
        thenConstantWorkspace = {
            maybeWriteKind: SerializerWriteKind.Indented,
        };
    } else {
        conditionWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        };
        thenConstantWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        };
    }
    setWorkspace(node.condition, state, conditionWorkspace);
    setWorkspace(node.thenConstant, state, thenConstantWorkspace);
    setWorkspace(node.trueExpression, state, {
        maybeIndentationChange: 1,
        maybeWriteKind: SerializerWriteKind.Indented,
    });

    const falseExpression: Ast.TExpression = node.falseExpression;
    let falseExpressionWorkspace: Workspace;
    if (falseExpression.kind === Ast.NodeKind.IfExpression) {
        falseExpressionWorkspace = {
            maybeWriteKind: SerializerWriteKind.PaddedLeft,
        };
    } else {
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

function visitWrapped(wrapped: Ast.TWrapped, state: State): void {
    const isMultiline: boolean = expectGetIsMultiline(wrapped, state.isMultilineMap);
    // not const as it's conditionally overwritten if SerializerWriteKind.Indented
    let workspace: Workspace = getWorkspace(wrapped, state);

    if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
        const writeKind: SerializerWriteKind = getWrapperOpenWriteKind(wrapped, state);

        if (writeKind !== SerializerWriteKind.Indented) {
            workspace = {
                maybeIndentationChange: undefined,
                maybeWriteKind: writeKind,
            };
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

function getWrapperOpenWriteKind(wrapped: Ast.TWrapped, state: State): SerializerWriteKind {
    // an open constant is multiline iff it is has a multiline comment
    const openIsMultiline: boolean = expectGetIsMultiline(wrapped.openWrapperConstant, state.isMultilineMap);
    if (openIsMultiline) {
        return SerializerWriteKind.Indented;
    }

    switch (wrapped.kind) {
        case Ast.NodeKind.InvokeExpression:
        case Ast.NodeKind.ItemAccessExpression:
            return SerializerWriteKind.Any;

        default:
            break;
    }

    const nodeIdMapCollection: NodeIdMap.Collection = state.nodeIdMapCollection;
    let maybeParent: Option<Ast.TNode> = maybeGetParent(nodeIdMapCollection, wrapped.id);
    if (maybeParent && maybeParent.kind === Ast.NodeKind.Csv) {
        maybeParent = maybeGetParent(nodeIdMapCollection, maybeParent.id);
    }
    if (maybeParent && maybeParent.kind === Ast.NodeKind.ArrayWrapper) {
        maybeParent = maybeGetParent(nodeIdMapCollection, maybeParent.id);
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

// By default SectionMembers are two newlines apart from one another.
// Like-named sections (ex. Foo.Alpha, Foo.Bravo) should be placed one newline apart.
function isSectionMemeberSimilarScope(left: Ast.SectionMember, right: Ast.SectionMember): boolean {
    const leftName: Ast.Identifier = left.namePairedExpression.key;
    const leftScope: ReadonlyArray<string> = leftName.literal.split(".");
    const rightName: Ast.Identifier = right.namePairedExpression.key;
    const rightScope: ReadonlyArray<string> = rightName.literal.split(".");

    return leftScope[0] === rightScope[0];
}

function isInMultilineTBinOpExpression(state: State, node: Ast.TBinOpExpression): boolean {
    const maybeParent: Option<Ast.TNode> = NodeIdMap.maybeParentAstNode(state.nodeIdMapCollection, node.id);
    if (maybeParent === undefined) {
        return false;
    }
    const parent: Ast.TNode = maybeParent;

    if (!Ast.isTBinOpExpression(parent)) {
        return false;
    }

    const parentOperatorWorkspace: Workspace = getWorkspace(parent.operatorConstant, state);
    return parentOperatorWorkspace.maybeWriteKind === SerializerWriteKind.Indented;
}
