// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
    Ast,
    CommonSettings,
    DefaultSettings,
    ILocalizationTemplates,
    LexParseOk,
    NodeIdMap,
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
import { Serializer, SerializerOptions, SerializerPassthroughMaps, SerializerSettings } from "./serializer";

export { Result, ResultKind } from "@microsoft/powerquery-parser";

export interface FormatSettings extends CommonSettings {
    readonly text: string;
    readonly options: SerializerOptions;
}

export function format(formatSettings: FormatSettings): Result<string, FormatError.TFormatError> {
    const triedLexParse: TriedLexParse = tryLexParse(DefaultSettings, formatSettings.text);
    if (triedLexParse.kind === ResultKind.Err) {
        return triedLexParse;
    }

    const lexParseOk: LexParseOk = triedLexParse.value;
    const ast: Ast.TDocument = lexParseOk.ast;
    const comments: ReadonlyArray<TComment> = lexParseOk.lexerSnapshot.comments;
    const nodeIdMapCollection: NodeIdMap.Collection = lexParseOk.nodeIdMapCollection;
    const localizationTemplates: ILocalizationTemplates = formatSettings.localizationTemplates;

    let commentCollectionMap: CommentCollectionMap = new Map();
    if (comments.length) {
        const triedCommentPass: Traverse.TriedTraverse<CommentCollectionMap> = tryTraverseComment(
            localizationTemplates,
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
        localizationTemplates,
        ast,
        commentCollectionMap,
        nodeIdMapCollection,
    );
    if (triedIsMultilineMap.kind === ResultKind.Err) {
        return triedIsMultilineMap;
    }
    const isMultilineMap: IsMultilineMap = triedIsMultilineMap.value;

    const triedSerializerParameter: Traverse.TriedTraverse<SerializerParameterMap> = tryTraverseSerializerParameter(
        localizationTemplates,
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
    const serializeRequest: SerializerSettings = {
        localizationTemplates: localizationTemplates,
        document: lexParseOk.ast,
        nodeIdMapCollection,
        maps,
        options: formatSettings.options,
    };

    return Serializer.run(serializeRequest);
}
