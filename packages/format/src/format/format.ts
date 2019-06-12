import {
    Ast,
    CommonError,
    lexAndParse,
    LexAndParseErr,
    LexAndParseOk,
    Option,
    Result,
    ResultKind,
    TComment,
    Traverse,
} from "@microsoft/powerquery-parser";
import { FormatError } from ".";
import * as commentPass from "./passes/comment";
import { IsMultilineMap } from "./passes/isMultiline/common";
import * as isMultilinePass from "./passes/isMultiline/isMultiline";
import * as parentPass from "./passes/parent";
import * as serializerParameterPass from "./passes/serializerParameter";
import { Serializer, SerializerOptions, SerializerPassthroughMaps, SerializerRequest } from "./serializer";

export interface FormatRequest {
    readonly text: string;
    readonly options: SerializerOptions;
}

export function format(formatRequest: FormatRequest): Result<string, FormatError.TFormatError> {
    const parseResult: Result<LexAndParseOk, LexAndParseErr> = lexAndParse(formatRequest.text);
    if (parseResult.kind === ResultKind.Err) {
        return parseResult;
    }

    const parseSuccess: LexAndParseOk = parseResult.value;
    const ast: Ast.TDocument = parseSuccess.ast;
    const comments: ReadonlyArray<TComment> = parseSuccess.comments;

    let commentCollectionMap: commentPass.CommentCollectionMap = new Map();
    const maybeCommentPassRequest: Option<commentPass.Request> = commentPass.createTraversalRequest(ast, comments);
    if (maybeCommentPassRequest) {
        const commentPassRequest: commentPass.Request = maybeCommentPassRequest;
        const commentPassResult: Result<
            commentPass.CommentCollectionMap,
            CommonError.CommonError
        > = Traverse.traverseAst(commentPassRequest);
        if (commentPassResult.kind === ResultKind.Err) {
            return commentPassResult;
        } else {
            commentCollectionMap = commentPassResult.value;
        }
    }

    const parentPassRequest: parentPass.Request = parentPass.createTraversalRequest(ast);
    const parentPassResult: Result<parentPass.ParentMap, CommonError.CommonError> = Traverse.traverseAst(
        parentPassRequest,
    );
    if (parentPassResult.kind === ResultKind.Err) {
        return parentPassResult;
    }
    const parentMap: parentPass.ParentMap = parentPassResult.value;

    const isMultilinePassResult: Result<
        IsMultilineMap,
        CommonError.CommonError
    > = isMultilinePass.runMultipleTraversalRequests(ast, commentCollectionMap, parentMap);
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
        document: parseSuccess.ast,
        maps,
        options: formatRequest.options,
    };

    return Serializer.run(serializeRequest);
}
