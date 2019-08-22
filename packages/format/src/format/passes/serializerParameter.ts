// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, CommonError, isNever, NodeIdMap, Option, TComment, Traverse } from "@microsoft/powerquery-parser";
import { CommentCollection, CommentCollectionMap } from "./comment";
import { maybeGetParent } from "./common";
import { expectGetIsMultiline, IsMultilineMap } from "./isMultiline/common";

// TNodes (in general) have two responsibilities:
// * if given a Workspace, then propagate the SerializerWriteKind to their first child,
//   this is done using propagateWorkspace(parentNode, childstate, node)
// * suggest an indentation change and SerializerWriteKind for their children,
//   this is done using setWorkspace(childstate, node, workspace)

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
        state,
        nodeIdMapCollection,
        ast,
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

function visitNode(state: State, node: Ast.TNode): void {
    switch (node.kind) {
        case Ast.NodeKind.ArrayWrapper: {
            const parent: Ast.TNode = NodeIdMap.expectParentAstNode(state.nodeIdMapCollection, node.id);

            switch (parent.kind) {
                case Ast.NodeKind.Section:
                    visitArrayWrapperForSectionMembers(state, parent.sectionMembers);
                    break;

                default:
                    visitArrayWrapper(state, node);
                    break;
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
            propagateWriteKind(state, node, node.constant);

            const isPairedMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node.paired);
            if (isPairedMultiline) {
                setWorkspace(state, node.paired, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            } else {
                setWorkspace(state, node.paired, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
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
            propagateWriteKind(state, node, node.left);

            if (expectGetIsMultiline(state.isMultilineMap, node)) {
                setWorkspace(state, node.operatorConstant, { maybeWriteKind: SerializerWriteKind.Indented });
                setWorkspace(state, node.right, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            } else if (node.kind === Ast.NodeKind.LogicalExpression) {
                setWorkspace(state, node.operatorConstant, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
                setWorkspace(state, node.right, { maybeWriteKind: SerializerWriteKind.Indented });
            } else {
                setWorkspace(state, node.operatorConstant, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
                setWorkspace(state, node.right, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }

            break;
        }

        // TKeyValuePair
        case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
        case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
        case Ast.NodeKind.IdentifierExpressionPairedExpression:
        case Ast.NodeKind.IdentifierPairedExpression:
            visitKeyValuePair(state, node);
            break;

        case Ast.NodeKind.ListLiteral:
        case Ast.NodeKind.ListExpression:
        case Ast.NodeKind.RecordExpression:
        case Ast.NodeKind.RecordLiteral:
            visitWrapped(state, node);
            break;

        case Ast.NodeKind.Csv: {
            const workspace: Workspace = getWorkspace(state, node);
            const maybeWriteKind: Option<SerializerWriteKind> = workspace.maybeWriteKind;
            propagateWriteKind(state, node, node.node);

            if (node.maybeCommaConstant && maybeWriteKind !== SerializerWriteKind.Indented) {
                const commaConstant: Ast.Constant = node.maybeCommaConstant;

                setWorkspace(state, commaConstant, { maybeWriteKind: SerializerWriteKind.PaddedRight });
            }
            break;
        }

        case Ast.NodeKind.ErrorHandlingExpression: {
            const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);
            propagateWriteKind(state, node, node.tryConstant);

            const protectedIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node.protectedExpression);
            if (protectedIsMultiline) {
                setWorkspace(state, node.protectedExpression, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            } else {
                setWorkspace(state, node.protectedExpression, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }

            if (node.maybeOtherwiseExpression) {
                const otherwiseExpression: Ast.OtherwiseExpression = node.maybeOtherwiseExpression;

                let otherwiseWriteKind: SerializerWriteKind;
                if (isMultiline) {
                    otherwiseWriteKind = SerializerWriteKind.Indented;
                } else {
                    otherwiseWriteKind = SerializerWriteKind.PaddedLeft;
                }

                setWorkspace(state, otherwiseExpression, { maybeWriteKind: otherwiseWriteKind });
            }
            break;
        }

        // TPairedConstant override
        case Ast.NodeKind.ErrorRaisingExpression: {
            propagateWriteKind(state, node, node.constant);

            let pairedWorkspace: Workspace;
            switch (node.paired.kind) {
                case Ast.NodeKind.ListExpression:
                case Ast.NodeKind.RecordExpression:
                    pairedWorkspace = {
                        maybeWriteKind: SerializerWriteKind.PaddedLeft,
                    };
                    break;

                default:
                    const pairedIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node.paired);
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
            setWorkspace(state, node.paired, pairedWorkspace);
            break;
        }

        case Ast.NodeKind.FieldProjection:
            visitWrapped(state, node);
            break;

        case Ast.NodeKind.FieldSelector:
            propagateWriteKind(state, node, node.openWrapperConstant);
            break;

        case Ast.NodeKind.FieldSpecification: {
            const maybeOptionalConstant: Option<Ast.Constant> = node.maybeOptionalConstant;

            if (maybePropagateWriteKind(state, node, maybeOptionalConstant)) {
                setWorkspace(state, node.name, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            } else {
                propagateWriteKind(state, node, node.name);
            }

            const maybeFieldTypeSpeification: Option<Ast.FieldTypeSpecification> = node.maybeFieldTypeSpeification;
            if (maybeFieldTypeSpeification) {
                const fieldTypeSpecification: Ast.FieldTypeSpecification = maybeFieldTypeSpeification;
                const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, fieldTypeSpecification);
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
                setWorkspace(state, fieldTypeSpecification, typeWorkspace);
            }
            break;
        }

        case Ast.NodeKind.FieldSpecificationList: {
            const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);
            const fieldsArray: Ast.IArrayWrapper<Ast.ICsv<Ast.FieldSpecification>> = node.content;
            visitWrapped(state, node);

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
                setWorkspace(state, openRecordMarkerConstant, workspace);
            }

            break;
        }

        case Ast.NodeKind.FieldTypeSpecification: {
            // can't use propagateWriteKind as I want the equalConstant on the
            // same line as the previous node (FieldParameter).
            const workspace: Workspace = getWorkspace(state, node);

            // assumes SerializerWriteKind.Indented -> maybeIndentationChange === 1
            if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
                setWorkspace(state, node.equalConstant, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
                setWorkspace(state, node.fieldType, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            } else {
                propagateWriteKind(state, node, node.equalConstant);
                setWorkspace(state, node.fieldType, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }
            break;
        }

        case Ast.NodeKind.FunctionExpression: {
            propagateWriteKind(state, node, node.parameters);

            if (node.maybeFunctionReturnType) {
                const functionReturnType: Ast.AsNullablePrimitiveType = node.maybeFunctionReturnType;
                setWorkspace(state, functionReturnType, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }

            setWorkspace(state, node.fatArrowConstant, { maybeWriteKind: SerializerWriteKind.PaddedLeft });

            const expressionIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node.expression);
            let expressionWorkspace: Workspace;
            if (expressionIsMultiline) {
                expressionWorkspace = {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                };
            } else {
                expressionWorkspace = { maybeWriteKind: SerializerWriteKind.PaddedLeft };
            }
            setWorkspace(state, node.expression, expressionWorkspace);

            break;
        }

        case Ast.NodeKind.FunctionType: {
            propagateWriteKind(state, node, node.functionConstant);

            const commonWorkspace: Workspace = {
                maybeWriteKind: SerializerWriteKind.PaddedLeft,
            };
            setWorkspace(state, node.parameters, commonWorkspace);
            setWorkspace(state, node.functionReturnType, commonWorkspace);
            break;
        }

        case Ast.NodeKind.IdentifierExpression:
            if (maybePropagateWriteKind(state, node, node.maybeInclusiveConstant)) {
                setWorkspace(state, node.identifier, DefaultWorkspace);
            } else {
                propagateWriteKind(state, node, node.identifier);
            }
            break;

        case Ast.NodeKind.IfExpression:
            visitIfExpression(state, node);
            break;

        case Ast.NodeKind.InvokeExpression:
            visitWrapped(state, node);
            break;

        case Ast.NodeKind.ItemAccessExpression: {
            const isMultilineMap: IsMultilineMap = state.isMultilineMap;
            const isMultiline: boolean = expectGetIsMultiline(isMultilineMap, node);
            const itemSelector: Ast.TExpression = node.content;
            const itemSelectorIsMultiline: boolean = expectGetIsMultiline(isMultilineMap, itemSelector);
            visitWrapped(state, node);

            if (isMultiline) {
                setWorkspace(state, itemSelector, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }

            let closeWrapperConstantWorkspace: Workspace;
            if (itemSelectorIsMultiline) {
                switch (itemSelector.kind) {
                    case Ast.NodeKind.ListExpression:
                    case Ast.NodeKind.RecordExpression:
                        closeWrapperConstantWorkspace = { maybeWriteKind: SerializerWriteKind.Any };
                        break;

                    default:
                        closeWrapperConstantWorkspace = { maybeWriteKind: SerializerWriteKind.Indented };
                        break;
                }
            } else {
                closeWrapperConstantWorkspace = {
                    maybeWriteKind: SerializerWriteKind.Any,
                };
            }
            setWorkspace(state, node.closeWrapperConstant, closeWrapperConstantWorkspace);
            break;
        }

        case Ast.NodeKind.LetExpression:
            propagateWriteKind(state, node, node.letConstant);
            setWorkspace(state, node.inConstant, { maybeWriteKind: SerializerWriteKind.Indented });
            setWorkspace(state, node.expression, {
                maybeIndentationChange: 1,
                maybeWriteKind: SerializerWriteKind.Indented,
            });
            break;

        case Ast.NodeKind.ListType: {
            const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);
            visitWrapped(state, node);

            if (isMultiline) {
                setWorkspace(state, node.content, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            break;
        }

        case Ast.NodeKind.MetadataExpression: {
            const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);
            propagateWriteKind(state, node, node.left);

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

            setWorkspace(state, node.constant, otherWorkspace);
            setWorkspace(state, node.right, otherWorkspace);
            break;
        }

        case Ast.NodeKind.NotImplementedExpression:
            propagateWriteKind(state, node, node.ellipsisConstant);
            break;

        case Ast.NodeKind.Parameter: {
            if (node.maybeOptionalConstant) {
                const optionalConstant: Ast.Constant = node.maybeOptionalConstant;
                setWorkspace(state, optionalConstant, { maybeWriteKind: SerializerWriteKind.PaddedRight });
            }

            if (node.maybeParameterType) {
                const parameterType: Ast.TParameterType = node.maybeParameterType;
                setWorkspace(state, parameterType, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }

            break;
        }

        case Ast.NodeKind.ParameterList:
            propagateWriteKind(state, node, node.openWrapperConstant);
            break;

        case Ast.NodeKind.ParenthesizedExpression: {
            const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);
            visitWrapped(state, node);

            if (isMultiline) {
                setWorkspace(state, node.content, {
                    maybeIndentationChange: 1,
                    maybeWriteKind: SerializerWriteKind.Indented,
                });
            }
            break;
        }

        case Ast.NodeKind.PrimitiveType:
            propagateWriteKind(state, node, node.primitiveType);
            break;

        // Assumes the parent must be a CsvArray owned by a ListExpression,
        // meaning the Workspace can only get set in visitCsvArray.
        case Ast.NodeKind.RangeExpression: {
            const workspace: Workspace = getWorkspace(state, node);
            propagateWriteKind(state, node, node.left);

            if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
                setWorkspace(state, node.rangeConstant, { maybeWriteKind: SerializerWriteKind.Indented });
                setWorkspace(state, node.right, { maybeWriteKind: SerializerWriteKind.Indented });
            }

            break;
        }

        case Ast.NodeKind.RecordType: {
            const workspace: Workspace = getWorkspace(state, node);
            setWorkspace(state, node.fields, workspace);
            break;
        }

        case Ast.NodeKind.RecursivePrimaryExpression:
            propagateWriteKind(state, node, node.head);
            break;

        case Ast.NodeKind.TableType: {
            propagateWriteKind(state, node, node.tableConstant);
            const rowType: Ast.FieldSpecificationList | Ast.TPrimaryExpression = node.rowType;
            const rowTypeIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, rowType);

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
            setWorkspace(state, rowType, rowTypeWorkspace);
            break;
        }

        case Ast.NodeKind.Section: {
            const isMultilineMap: IsMultilineMap = state.isMultilineMap;

            let sectionConstantWriteKind: SerializerWriteKind = SerializerWriteKind.Any;
            const maybeLiteralAttributes: Option<Ast.RecordLiteral> = node.maybeLiteralAttributes;
            if (maybeLiteralAttributes) {
                const literalAttributes: Ast.RecordLiteral = maybeLiteralAttributes;

                if (expectGetIsMultiline(isMultilineMap, literalAttributes)) {
                    sectionConstantWriteKind = SerializerWriteKind.Indented;
                } else {
                    sectionConstantWriteKind = SerializerWriteKind.PaddedLeft;
                }
            }
            setWorkspace(state, node.sectionConstant, { maybeWriteKind: sectionConstantWriteKind });

            const maybeName: Option<Ast.Identifier> = node.maybeName;
            if (maybeName) {
                const name: Ast.Identifier = maybeName;
                setWorkspace(state, name, { maybeWriteKind: SerializerWriteKind.PaddedLeft });
            }

            break;
        }

        case Ast.NodeKind.SectionMember: {
            const isMultilineMap: IsMultilineMap = state.isMultilineMap;
            let maybeSharedConstantWriteKind: Option<SerializerWriteKind>;
            let isNameExpressionPairWorkspaceSet: boolean = false;

            if (node.maybeLiteralAttributes) {
                const literalAttributes: Ast.RecordLiteral = node.maybeLiteralAttributes;
                propagateWriteKind(state, node, literalAttributes);

                if (expectGetIsMultiline(isMultilineMap, literalAttributes)) {
                    maybeSharedConstantWriteKind = SerializerWriteKind.Indented;
                } else {
                    maybeSharedConstantWriteKind = SerializerWriteKind.PaddedLeft;
                }
            } else if (node.maybeSharedConstant) {
                const sharedConstant: Ast.Constant = node.maybeSharedConstant;
                propagateWriteKind(state, node, sharedConstant);
            } else {
                propagateWriteKind(state, node, node.namePairedExpression);
                isNameExpressionPairWorkspaceSet = true;
            }

            if (node.maybeSharedConstant && maybeSharedConstantWriteKind) {
                const sharedConstant: Ast.Constant = node.maybeSharedConstant;
                setWorkspace(state, sharedConstant, { maybeWriteKind: maybeSharedConstantWriteKind });
            }

            if (!isNameExpressionPairWorkspaceSet) {
                let isNameExpressionPairIndented: boolean = false;
                if (node.maybeSharedConstant) {
                    const sharedConstant: Ast.Constant = node.maybeSharedConstant;

                    if (expectGetIsMultiline(isMultilineMap, sharedConstant)) {
                        isNameExpressionPairIndented = true;
                    }
                } else if (node.maybeLiteralAttributes) {
                    const literalAttributes: Ast.RecordLiteral = node.maybeLiteralAttributes;

                    if (expectGetIsMultiline(isMultilineMap, literalAttributes)) {
                        isNameExpressionPairIndented = true;
                    }
                }

                let writeKind: SerializerWriteKind;
                if (isNameExpressionPairIndented) {
                    writeKind = SerializerWriteKind.Indented;
                } else {
                    writeKind = SerializerWriteKind.PaddedLeft;
                }
                setWorkspace(state, node.namePairedExpression, { maybeWriteKind: writeKind });
            }
            break;
        }

        // TPairedConstant overload
        case Ast.NodeKind.TypePrimaryType: {
            propagateWriteKind(state, node, node.constant);

            const paired: Ast.TPrimaryType = node.paired;
            const pairedIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, paired);
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
            setWorkspace(state, paired, pairedWorkspace);
            break;
        }

        case Ast.NodeKind.UnaryExpression:
            propagateWriteKind(state, node, node.operators.elements[0]);
            break;

        // Leaf nodes.
        // If a parent gave the leaf node a workspace it assigns indentationChange,
        // while writeType can be overwritten if the leaf node has a multiline comment attached.
        case Ast.NodeKind.Constant:
        case Ast.NodeKind.GeneralizedIdentifier:
        case Ast.NodeKind.Identifier:
        case Ast.NodeKind.LiteralExpression: {
            const workspace: Workspace = getWorkspace(state, node);
            maybeSetIndentationChange(state, node, workspace.maybeIndentationChange);

            let maybeWriteKind: Option<SerializerWriteKind> = workspace.maybeWriteKind;
            maybeWriteKind = visitComments(state, node, maybeWriteKind);
            if (!maybeWriteKind) {
                const details: {} = {
                    node,
                    maybeWriteKind: maybeWriteKind,
                };
                throw new CommonError.InvariantError("maybeWriteKind should be truthy", details);
            }

            state.result.writeKind.set(node.id, maybeWriteKind);
            break;
        }

        default:
            isNever(node);
    }
}

function getWorkspace(state: State, node: Ast.TNode, fallback: Workspace = DefaultWorkspace): Workspace {
    const maybeWorkspace: Option<Workspace> = state.workspaceMap.get(node.id);

    if (maybeWorkspace !== undefined) {
        return maybeWorkspace;
    } else {
        return fallback;
    }
}

function setWorkspace(state: State, node: Ast.TNode, workspace: Workspace): void {
    state.workspaceMap.set(node.id, workspace);
}

// sets indentationChange for the parent using the parent's Workspace,
// then propagates the writeKind to firstChild by setting its Workspace.
function propagateWriteKind(state: State, parent: Ast.TNode, firstChild: Ast.TNode): void {
    const workspace: Workspace = getWorkspace(state, parent);
    maybeSetIndentationChange(state, parent, workspace.maybeIndentationChange);

    const maybeWriteKind: Option<SerializerWriteKind> = workspace.maybeWriteKind;
    if (maybeWriteKind) {
        setWorkspace(state, firstChild, { maybeWriteKind: maybeWriteKind });
    }
}

function maybePropagateWriteKind(state: State, parent: Ast.TNode, maybeFirstChild: Option<Ast.TNode>): boolean {
    if (maybeFirstChild) {
        const firstChild: Ast.TNode = maybeFirstChild;
        propagateWriteKind(state, parent, firstChild);
        return true;
    } else {
        return false;
    }
}

function maybeSetIndentationChange(
    state: State,
    node: Ast.TNode,
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
    state: State,
    node: Ast.TNode,
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

function visitKeyValuePair(state: State, node: Ast.TKeyValuePair): void {
    const isMultilineMap: IsMultilineMap = state.isMultilineMap;
    const equalConstantIsMultiline: boolean = expectGetIsMultiline(isMultilineMap, node.equalConstant);
    const valueIsMultiline: boolean = expectGetIsMultiline(isMultilineMap, node.value);
    propagateWriteKind(state, node, node.key);

    let equalWorkspace: Workspace;
    if (equalConstantIsMultiline) {
        equalWorkspace = { maybeWriteKind: SerializerWriteKind.Indented };
    } else {
        equalWorkspace = { maybeWriteKind: SerializerWriteKind.PaddedLeft };
    }
    setWorkspace(state, node.equalConstant, equalWorkspace);

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
    setWorkspace(state, node.value, valueWorkspace);
}

function visitArrayWrapper(state: State, node: Ast.TArrayWrapper): void {
    const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);

    let maybeWriteKind: Option<SerializerWriteKind>;
    let maybeIndentationChange: Option<IndentationChange>;
    if (isMultiline) {
        maybeWriteKind = SerializerWriteKind.Indented;
        maybeIndentationChange = 1;
    } else {
        maybeWriteKind = SerializerWriteKind.Any;
    }

    for (const element of node.elements) {
        setWorkspace(state, element, {
            maybeWriteKind,
            maybeIndentationChange,
        });
    }
}

function visitArrayWrapperForSectionMembers(state: State, node: Ast.IArrayWrapper<Ast.SectionMember>): void {
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

        setWorkspace(state, member, { maybeWriteKind: memberWriteKind });

        maybePreviousSectionMember = member;
    }
}

function visitIfExpression(state: State, node: Ast.IfExpression): void {
    propagateWriteKind(state, node, node.ifConstant);

    const conditionIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node.condition);

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
    setWorkspace(state, node.condition, conditionWorkspace);
    setWorkspace(state, node.thenConstant, thenConstantWorkspace);
    setWorkspace(state, node.trueExpression, {
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
    setWorkspace(state, node.elseConstant, { maybeWriteKind: SerializerWriteKind.Indented });
    setWorkspace(state, falseExpression, falseExpressionWorkspace);
}

function visitWrapped(state: State, wrapped: Ast.TWrapped): void {
    const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, wrapped);
    // not const as it's conditionally overwritten if SerializerWriteKind.Indented
    let workspace: Workspace = getWorkspace(state, wrapped);

    if (workspace.maybeWriteKind === SerializerWriteKind.Indented) {
        const writeKind: SerializerWriteKind = wrapperOpenWriteKind(state, wrapped);

        if (writeKind !== SerializerWriteKind.Indented) {
            workspace = {
                maybeIndentationChange: undefined,
                maybeWriteKind: writeKind,
            };
        }
    }

    setWorkspace(state, wrapped, workspace);
    propagateWriteKind(state, wrapped, wrapped.openWrapperConstant);

    if (isMultiline) {
        setWorkspace(state, wrapped.closeWrapperConstant, { maybeWriteKind: SerializerWriteKind.Indented });
    }
}

function wrapperOpenWriteKind(state: State, wrapped: Ast.TWrapped): SerializerWriteKind {
    // an open constant is multiline iff it is has a multiline comment
    const openIsMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, wrapped.openWrapperConstant);
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
