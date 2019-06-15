import {
    Ast,
    CommonError,
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
import * as commentPass from "./passes/comment";
import { IsMultilineMap } from "./passes/isMultiline/common";
import * as isMultilinePass from "./passes/isMultiline/isMultiline";
import * as serializerParameterPass from "./passes/serializerParameter";
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

    let commentCollectionMap: commentPass.CommentCollectionMap = new Map();
    if (comments.length) {
        const triedCommentPass: Traverse.TriedTraverse<commentPass.CommentCollectionMap> = commentPass.tryTraverse(
            ast,
            nodeIdMapCollection,
            comments,
        );

        if (triedCommentPass.kind === ResultKind.Err) {
            return triedCommentPass;
        }
        commentCollectionMap = triedCommentPass.value;
    }

    const isMultilinePassResult: Traverse.TriedTraverse<IsMultilineMap> = isMultilinePass.tryTraverse(
        ast,
        commentCollectionMap,
        nodeIdMapCollection,
    );
    if (isMultilinePassResult.kind === ResultKind.Err) {
        return isMultilinePassResult;
    }
    const isMultilineMap: IsMultilineMap = isMultilinePassResult.value;

    const serializerParameterPassRequest: serializerParameterPass.Request = serializerParameterPass.createTraversalRequest(
        ast,
        parentMap,
        commentCollectionMap,
        isMultilineMap,
    );
    const serializerParameterPassResult: Result<
        serializerParameterPass.SerializerParameterMap,
        CommonError.CommonError
    > = Traverse.traverseAst(serializerParameterPassRequest);
    if (serializerParameterPassResult.kind === ResultKind.Err) {
        return serializerParameterPassResult;
    }
    const serializerParameterMap: serializerParameterPass.SerializerParameterMap = serializerParameterPassResult.value;

    const maps: SerializerPassthroughMaps = {
        commentCollectionMap,
        serializerParameterMap,
    };
    const serializeRequest: SerializerRequest = {
        document: lexAndParseOk.ast,
        maps,
        options: formatRequest.options,
    };

    return Serializer.run(serializeRequest);
}
