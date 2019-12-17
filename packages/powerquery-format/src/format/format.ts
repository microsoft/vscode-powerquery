// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Ast,
    LexParseOk,
    NodeIdMap,
    Parser,
    Result,
    ResultKind,
    TComment,
    Traverse,
    TriedLexParse,
    tryLexParse,
} from "@microsoft/powerquery-parser";
import { FormatError } from ".";
import { CommentCollectionMap, tryTraverse as tryTraverseComment } from "./passes/comment";
import { IsMultilineMap } from "./passes/isMultiline/common";
import { tryTraverse as tryTraverseIsMultilineMap } from "./passes/isMultiline/isMultiline";
import { SerializerParameterMap, tryTraverse as tryTraverseSerializerParameter } from "./passes/serializerParameter";
import { Serializer, SerializerOptions, SerializerPassthroughMaps, SerializerRequest } from "./serializer";

export { Result, ResultKind } from "@microsoft/powerquery-parser";

export interface FormatRequest {
    readonly text: string;
    readonly options: SerializerOptions;
}

export function format(formatRequest: FormatRequest): Result<string, FormatError.TFormatError> {
    const triedLexParse: TriedLexParse = tryLexParse(formatRequest.text, Parser.CombinatorialParser);
    if (triedLexParse.kind === ResultKind.Err) {
        return triedLexParse;
    }

    const lexParseOk: LexParseOk = triedLexParse.value;
    const ast: Ast.TDocument = lexParseOk.ast;
    const comments: ReadonlyArray<TComment> = lexParseOk.lexerSnapshot.comments;
    const nodeIdMapCollection: NodeIdMap.Collection = lexParseOk.nodeIdMapCollection;

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
        document: lexParseOk.ast,
        nodeIdMapCollection,
        maps,
        options: formatRequest.options,
    };

    return Serializer.run(serializeRequest);
}
