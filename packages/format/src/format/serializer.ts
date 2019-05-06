import { Ast, CommonError, isNever, Option, Result, ResultKind } from "powerquery-parser";
import { CommentCollectionMap } from "./passes/comment";
import { getSerializerWriteKind, SerializeCommentParameter, SerializerParameterMap, SerializerWriteKind } from "./passes/serializerParameter";

export const enum IndentationLiteral {
    SpaceX4 = "    ",
    Tab = "\t",
}

export const enum NewlineLiteral {
    Unix = "\n",
    Windows = "\r\n",
}

export class Serializer {
    constructor(
        private readonly document: Ast.TDocument,
        private readonly passthroughMaps: SerializerPassthroughMaps,
        private readonly serializerOptions: SerializerOptions,

        private formatted: string = "",
        private currentLine: string = "",

        private indentationLevel: number = 0,
        private readonly indentationCache: string[] = [""],
    ) {
        this.expandIndentationCache(10);
    }

    public static run(request: SerializerRequest): Result<string, CommonError.CommonError> {
        const serializer = new Serializer(
            request.document,
            request.maps,
            request.options,
        );

        try {
            return {
                kind: ResultKind.Ok,
                value: serializer.run(),
            };
        }
        catch (err) {
            return {
                kind: ResultKind.Err,
                error: CommonError.ensureCommonError(err),
            };
        }
    }

    private run(): string {
        this.visitNode(this.document);
        return this.formatted;
    }

    private append(str: string) {
        this.formatted += str;
        if (str === this.serializerOptions.newlineLiteral) {
            this.currentLine = "";
        }
        else {
            this.currentLine += str;
        }
    }

    private serialize(str: string, serializerWriteKind: SerializerWriteKind) {
        switch (serializerWriteKind) {
            case SerializerWriteKind.Any:
                this.append(str);
                break;

            case SerializerWriteKind.DoubleNewline:
                this.append(this.serializerOptions.newlineLiteral);
                this.append(this.serializerOptions.newlineLiteral);
                this.append(str);
                break;

            case SerializerWriteKind.Indented:
                this.serializeIndented(str);
                break;

            case SerializerWriteKind.PaddedLeft:
                this.serializePadded(str, true, false);
                break;

            case SerializerWriteKind.PaddedRight:
                this.serializePadded(str, false, true);
                break;

            default:
                throw isNever(serializerWriteKind);
        }
    }

    private serializeIndented(str: string) {
        if (this.currentLine !== "") {
            this.append(this.serializerOptions.newlineLiteral);
        }
        this.append(this.currentIndentation());
        this.append(str);
    }

    private serializePadded(str: string, padLeft: boolean, padRight: boolean) {
        if (padLeft && this.currentLine) {
            const lastWrittenCharacter = this.currentLine[this.currentLine.length - 1];
            if (lastWrittenCharacter !== " " && lastWrittenCharacter !== "\t") {
                this.append(" ");
            }
        }

        this.append(str);

        if (padRight) {
            this.append(" ");
        }
    }

    private visitNode(node: Ast.TNode) {
        const cacheKey = node.tokenRange.hash;
        const maybeIndentationChange = this.passthroughMaps.serializerParameterMap.indentationChange[cacheKey];
        if (maybeIndentationChange) {
            this.indentationLevel += 1;
        }

        if (node.terminalNode) {
            const maybeComments = this.passthroughMaps.serializerParameterMap.comments[cacheKey];
            if (maybeComments) {
                this.visitComments(maybeComments);
            }
        }

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
                this.visitNode(node.constant);
                this.visitNode(node.paired);
                break;

            // TBinOpExpression
            case Ast.NodeKind.ArithmeticExpression:
            case Ast.NodeKind.EqualityExpression:
            case Ast.NodeKind.LogicalExpression:
            case Ast.NodeKind.RelationalExpression:
                this.visitNode(node.first);
                this.visitArray(node.rest);
                break;

            // TBinOpKeyword
            case Ast.NodeKind.IsExpression:
            case Ast.NodeKind.AsExpression:
            case Ast.NodeKind.MetadataExpression:
                this.visitNode(node.left);
                this.visitNode(node.constant);
                this.visitNode(node.right);
                break;

            // TKeyValuePair
            case Ast.NodeKind.GeneralizedIdentifierPairedAnyLiteral:
            case Ast.NodeKind.GeneralizedIdentifierPairedExpression:
            case Ast.NodeKind.IdentifierExpressionPairedExpression:
            case Ast.NodeKind.IdentifierPairedExpression:
                this.visitNode(node.key);
                this.visitNode(node.equalConstant);
                this.visitNode(node.value);
                break;

            // TWrapped where Content is TCsv[] and no extra attributes
            case Ast.NodeKind.InvokeExpression:
            case Ast.NodeKind.ListExpression:
            case Ast.NodeKind.ListLiteral:
            case Ast.NodeKind.ParameterList:
            case Ast.NodeKind.RecordExpression:
            case Ast.NodeKind.RecordLiteral:
                this.visitNode(node.openWrapperConstant);
                this.visitArray(node.content);
                this.visitNode(node.closeWrapperConstant);
                break;

            case Ast.NodeKind.Csv:
                this.visitNode(node.node);
                this.maybeVisitNode(node.maybeCommaConstant);
                break;

            case Ast.NodeKind.Constant: {
                const writeKind = getSerializerWriteKind(node, this.passthroughMaps.serializerParameterMap);
                this.serialize(node.literal, writeKind);
                break;
            }

            case Ast.NodeKind.ErrorHandlingExpression:
                this.visitNode(node.tryConstant);
                this.visitNode(node.protectedExpression);
                this.maybeVisitNode(node.maybeOtherwiseExpression);
                break;

            case Ast.NodeKind.FieldProjection:
                this.visitNode(node.openWrapperConstant);
                this.visitArray(node.content);
                this.visitNode(node.closeWrapperConstant);
                this.maybeVisitNode(node.maybeOptionalConstant);
                break;

            case Ast.NodeKind.FieldSelector:
                this.visitNode(node.openWrapperConstant);
                this.visitNode(node.content);
                this.visitNode(node.closeWrapperConstant);
                this.maybeVisitNode(node.maybeOptionalConstant);
                break;

            case Ast.NodeKind.FieldSpecification:
                this.maybeVisitNode(node.maybeOptionalConstant);
                this.visitNode(node.name);
                this.maybeVisitNode(node.maybeFieldTypeSpeification);
                break;

            case Ast.NodeKind.FieldSpecificationList:
                this.visitNode(node.openWrapperConstant);
                this.visitArray(node.content);
                this.maybeVisitNode(node.maybeOpenRecordMarkerConstant);
                this.visitNode(node.closeWrapperConstant);
                break;

            case Ast.NodeKind.FieldTypeSpecification:
                this.visitNode(node.equalConstant);
                this.visitNode(node.fieldType);
                break;

            case Ast.NodeKind.FunctionExpression:
                this.visitNode(node.parameters);
                this.maybeVisitNode(node.maybeFunctionReturnType);
                this.visitNode(node.fatArrowConstant);
                this.visitNode(node.expression);
                break;

            case Ast.NodeKind.FunctionType:
                this.visitNode(node.functionConstant);
                this.visitNode(node.parameters);
                this.visitNode(node.functionReturnType);
                break;

            case Ast.NodeKind.GeneralizedIdentifier:
            case Ast.NodeKind.Identifier: {
                const writeKind = getSerializerWriteKind(node, this.passthroughMaps.serializerParameterMap);
                this.serialize(`${node.literal}`, writeKind);
                break;
            }

            case Ast.NodeKind.IdentifierExpression:
                this.maybeVisitNode(node.maybeInclusiveConstant);
                this.visitNode(node.identifier);
                break;

            case Ast.NodeKind.IfExpression:
                this.visitNode(node.ifConstant);
                this.visitNode(node.condition);

                this.visitNode(node.thenConstant);
                this.visitNode(node.trueExpression);

                this.visitNode(node.elseConstant);
                this.visitNode(node.falseExpression);
                break;

            case Ast.NodeKind.ItemAccessExpression:
                this.visitNode(node.openWrapperConstant);
                this.visitNode(node.content);
                this.visitNode(node.closeWrapperConstant);
                this.maybeVisitNode(node.maybeOptionalConstant);
                break;

            case Ast.NodeKind.LetExpression:
                this.visitNode(node.letConstant);
                this.visitArray(node.variableList);
                this.visitNode(node.inConstant);
                this.visitNode(node.expression);
                break;

            case Ast.NodeKind.ListType:
                this.visitNode(node.openWrapperConstant);
                this.visitNode(node.content);
                this.visitNode(node.closeWrapperConstant);
                break;

            case Ast.NodeKind.LiteralExpression: {
                const writeKind = getSerializerWriteKind(node, this.passthroughMaps.serializerParameterMap);
                this.serialize(node.literal, writeKind);
                break;
            }

            case Ast.NodeKind.NotImplementedExpression:
                this.visitNode(node.ellipsisConstant);
                break;

            case Ast.NodeKind.Parameter:
                this.maybeVisitNode(node.maybeOptionalConstant);
                this.visitNode(node.name);
                this.maybeVisitNode(node.maybeParameterType);
                break;

            case Ast.NodeKind.ParenthesizedExpression:
                this.visitNode(node.openWrapperConstant);
                this.visitNode(node.content);
                this.visitNode(node.closeWrapperConstant);
                break;

            case Ast.NodeKind.PrimitiveType:
                this.visitNode(node.primitiveType);
                break;

            case Ast.NodeKind.RecordType:
                this.visitNode(node.fields);
                break;

            case Ast.NodeKind.RecursivePrimaryExpression:
                this.visitNode(node.head);
                this.visitArray(node.recursiveExpressions);
                break;

            case Ast.NodeKind.Section:
                this.maybeVisitNode(node.maybeLiteralAttributes);
                this.visitNode(node.sectionConstant);
                this.maybeVisitNode(node.maybeName);
                this.visitNode(node.semicolonConstant);
                this.visitArray(node.sectionMembers);
                break;

            case Ast.NodeKind.SectionMember: {
                this.maybeVisitNode(node.maybeLiteralAttributes);
                this.maybeVisitNode(node.maybeSharedConstant);
                this.visitNode(node.namePairedExpression);
                this.visitNode(node.semicolonConstant);
                break;
            }

            case Ast.NodeKind.TableType:
                this.visitNode(node.tableConstant);
                this.visitNode(node.rowType);
                break;

            case Ast.NodeKind.UnaryExpression:
                this.visitArray(node.expressions);
                break;

            case Ast.NodeKind.UnaryExpressionHelper:
                this.visitNode(node.operatorConstant);
                this.visitNode(node.node);
                break;

            default:
                throw isNever(node);
        }

        if (maybeIndentationChange) {
            this.indentationLevel -= maybeIndentationChange;
        }
    }

    private maybeVisitNode(maybeNode: Option<Ast.TNode>) {
        if (maybeNode) {
            this.visitNode(maybeNode);
        }
    }

    private visitArray(nodes: ReadonlyArray<Ast.TNode>) {
        for (const node of nodes) {
            this.visitNode(node);
        }
    }

    private visitComments(collection: ReadonlyArray<SerializeCommentParameter>) {
        for (const comment of collection) {
            this.serialize(comment.literal, comment.writeKind);
        }
    }

    private currentIndentation(): string {
        let indentationLiteral = this.indentationCache[this.indentationLevel];
        if (indentationLiteral === undefined) {
            this.expandIndentationCache(this.indentationLevel);
            indentationLiteral = this.indentationCache[this.indentationLevel];
        }
        return indentationLiteral;
    }

    private expandIndentationCache(level: number) {
        for (let i = this.indentationCache.length; i <= level; i++) {
            const previousIndentation = this.indentationCache[i - 1];
            this.indentationCache[i] = previousIndentation + this.serializerOptions.indentationLiteral;
        }
    }
}

export interface SerializerRequest {
    readonly document: Ast.TDocument,
    readonly maps: SerializerPassthroughMaps,
    readonly options: SerializerOptions,
}

export interface SerializerPassthroughMaps {
    readonly commentCollectionMap: CommentCollectionMap,
    readonly serializerParameterMap: SerializerParameterMap,
}

export interface SerializerOptions {
    readonly indentationLiteral: IndentationLiteral,
    readonly newlineLiteral: NewlineLiteral,
}
