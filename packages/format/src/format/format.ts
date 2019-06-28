// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Ast,
    LexAndParseOk,
    NodeIdMap,
    Result,
    ResultKind,
    TComment,
    Traverse,
    TriedLexAndParse,
    tryLexAndParse,
} from "@microsoft/powerquery-parser";
import { FormatError } from ".";
import { CommentCollectionMap, tryTraverse as tryTraverseComment } from "./passes/comment";
import { IsMultilineMap } from "./passes/isMultiline/common";
import { tryTraverse as tryTraverseIsMultilineMap } from "./passes/isMultiline/isMultiline";
import { SerializerParameterMap, tryTraverse as tryTraverseSerializerParameter } from "./passes/serializerParameter";
import { Serializer, SerializerOptions, SerializerPassthroughMaps, SerializerRequest } from "./serializer";

export interface FormatRequest {
    readonly text: string;
    readonly options: SerializerOptions;
}

export function format(formatRequest: FormatRequest): Result<string, FormatError.TFormatError> {
    const triedLexAndParse: TriedLexAndParse = tryLexAndParse(formatRequest.text);
    if (triedLexAndParse.kind === ResultKind.Err) {
        return triedLexAndParse;
    }

    const lexAndParseOk: LexAndParseOk = triedLexAndParse.value;
    const ast: Ast.TDocument = lexAndParseOk.ast;
    const comments: ReadonlyArray<TComment> = lexAndParseOk.comments;
    const nodeIdMapCollection: NodeIdMap.Collection = lexAndParseOk.nodeIdMapCollection;

    let commentCollectionMap: CommentCollectionMap = new Map();
    if (comments.length) {
        const triedCommentPass: Traverse.TriedTraverse<CommentCollectionMap> = tryTraverseComment(
            ast,
            nodeIdMapCollection,
            comments,
        );

        if (triedCommentPass.kind === ResultKind.Err) {
            return triedCommentPass;
        }
        commentCollectionMap = triedCommentPass.value;
    }

    const triedIsMultilineMap: Traverse.TriedTraverse<IsMultilineMap> = tryTraverseIsMultilineMap(
        ast,
        commentCollectionMap,
        nodeIdMapCollection,
    );
    if (triedIsMultilineMap.kind === ResultKind.Err) {
        return triedIsMultilineMap;
    }
    const isMultilineMap: IsMultilineMap = triedIsMultilineMap.value;

    const triedSerializerParameter: Traverse.TriedTraverse<SerializerParameterMap> = tryTraverseSerializerParameter(
        ast,
        nodeIdMapCollection,
        commentCollectionMap,
        isMultilineMap,
    );
    if (triedSerializerParameter.kind === ResultKind.Err) {
        return triedSerializerParameter;
    }
    const serializerParameterMap: SerializerParameterMap = triedSerializerParameter.value;

    const maps: SerializerPassthroughMaps = {
        commentCollectionMap,
        serializerParameterMap,
    };
    const serializeRequest: SerializerRequest = {
        document: lexAndParseOk.ast,
        nodeIdMapCollection,
        maps,
        options: formatRequest.options,
    };

    return Serializer.run(serializeRequest);
}
