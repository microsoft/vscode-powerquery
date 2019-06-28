// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Ast, CommonError, isNever, NodeIdMap, Option, Result, ResultKind } from "@microsoft/powerquery-parser";
import { CommentCollectionMap } from "./passes/comment";
import {
    getSerializerWriteKind,
    IndentationChange,
    SerializeCommentParameter,
    SerializerParameterMap,
    SerializerWriteKind,
} from "./passes/serializerParameter";

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
        private readonly nodeIdMapCollection: NodeIdMap.Collection,
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
        const serializer: Serializer = new Serializer(
            request.document,
            request.nodeIdMapCollection,
            request.maps,
            request.options,
        );

        try {
            return {
                kind: ResultKind.Ok,
                value: serializer.run(),
            };
        } catch (err) {
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

    private append(str: string): void {
        this.formatted += str;
        if (str === this.serializerOptions.newlineLiteral) {
            this.currentLine = "";
        } else {
            this.currentLine += str;
        }
    }

    private serialize(str: string, serializerWriteKind: SerializerWriteKind): void {
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

    private serializeIndented(str: string): void {
        if (this.currentLine !== "") {
            this.append(this.serializerOptions.newlineLiteral);
        }
        this.append(this.currentIndentation());
        this.append(str);
    }

    private serializePadded(str: string, padLeft: boolean, padRight: boolean): void {
        if (padLeft && this.currentLine) {
            const lastWrittenCharacter: Option<string> = this.currentLine[this.currentLine.length - 1];
            if (lastWrittenCharacter !== " " && lastWrittenCharacter !== "\t") {
                this.append(" ");
            }
        }

        this.append(str);

        if (padRight) {
            this.append(" ");
        }
    }

    private visitNode(node: Ast.TNode): void {
        const cacheKey: number = node.id;
        const maybeIndentationChange: Option<
            IndentationChange
        > = this.passthroughMaps.serializerParameterMap.indentationChange.get(cacheKey);
        if (maybeIndentationChange) {
            this.indentationLevel += 1;
        }

        if (node.isLeaf) {
            const maybeComments: Option<
                ReadonlyArray<SerializeCommentParameter>
            > = this.passthroughMaps.serializerParameterMap.comments.get(cacheKey);
            if (maybeComments) {
                this.visitComments(maybeComments);
            }
        }

        switch (node.kind) {
            case Ast.NodeKind.Constant: {
                const writeKind: SerializerWriteKind = getSerializerWriteKind(
                    node,
                    this.passthroughMaps.serializerParameterMap,
                );
                this.serialize(node.literal, writeKind);
                break;
            }

            case Ast.NodeKind.GeneralizedIdentifier:
            case Ast.NodeKind.Identifier: {
                const writeKind: SerializerWriteKind = getSerializerWriteKind(
                    node,
                    this.passthroughMaps.serializerParameterMap,
                );
                this.serialize(`${node.literal}`, writeKind);
                break;
            }

            case Ast.NodeKind.LiteralExpression: {
                const writeKind: SerializerWriteKind = getSerializerWriteKind(
                    node,
                    this.passthroughMaps.serializerParameterMap,
                );
                this.serialize(node.literal, writeKind);
                break;
            }

            default:
                const children: ReadonlyArray<Ast.TNode> = NodeIdMap.expectAstChildNodes(
                    this.nodeIdMapCollection,
                    node.id,
                );
                for (const child of children) {
                    this.visitNode(child);
                }
                break;
        }

        if (maybeIndentationChange) {
            this.indentationLevel -= maybeIndentationChange;
        }
    }

    private visitComments(collection: ReadonlyArray<SerializeCommentParameter>): void {
        for (const comment of collection) {
            this.serialize(comment.literal, comment.writeKind);
        }
    }

    private currentIndentation(): string {
        const maybeIndentationLiteral: Option<string> = this.indentationCache[this.indentationLevel];
        if (maybeIndentationLiteral === undefined) {
            return this.expandIndentationCache(this.indentationLevel);
        } else {
            return maybeIndentationLiteral;
        }
    }

    private expandIndentationCache(level: number): string {
        for (let index: number = this.indentationCache.length; index <= level; index += 1) {
            const previousIndentation: string = this.indentationCache[index - 1] || "";
            this.indentationCache[index] = previousIndentation + this.serializerOptions.indentationLiteral;
        }

        return this.indentationCache[this.indentationCache.length - 1];
    }
}

export interface SerializerRequest {
    readonly document: Ast.TDocument;
    readonly nodeIdMapCollection: NodeIdMap.Collection;
    readonly maps: SerializerPassthroughMaps;
    readonly options: SerializerOptions;
}

export interface SerializerPassthroughMaps {
    readonly commentCollectionMap: CommentCollectionMap;
    readonly serializerParameterMap: SerializerParameterMap;
}

export interface SerializerOptions {
    readonly indentationLiteral: IndentationLiteral;
    readonly newlineLiteral: NewlineLiteral;
}
