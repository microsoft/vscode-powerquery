import { lexAndParse, LexAndParseErr, LexAndParseOk, Result, ResultKind, Traverse } from "@microsoft/powerquery-parser";
import { FormatError } from "./error";
import * as commentPass from "./passes/comment";
import * as isMultilinePass from "./passes/isMultiline/isMultiline";
import * as parentPass from "./passes/parent";
import * as serializerParameterPass from "./passes/serializerParameter";
import { Serializer, SerializerOptions, SerializerPassthroughMaps, SerializerRequest } from "./serializer";

export interface FormatRequest {
    readonly text: string,
    readonly options: SerializerOptions,
}

export function format(formatRequest: FormatRequest): Result<string, FormatError.TFormatError> {
    const parseResult: Result<LexAndParseOk, LexAndParseErr> = lexAndParse(formatRequest.text);
    if (parseResult.kind === ResultKind.Err) {
        return parseResult;
    }

    const parseSuccess = parseResult.value;
    const ast = parseSuccess.ast;
    const comments = parseSuccess.comments;

    let commentCollectionMap: commentPass.CommentCollectionMap = new Map();
    const commentPassRequest = commentPass.createTraversalRequest(ast, comments);
    if (commentPassRequest) {
        const commentPassResult = Traverse.traverseAst(commentPassRequest);
        if (commentPassResult.kind === ResultKind.Err) {
            return commentPassResult;
        }
        else {
            commentCollectionMap = commentPassResult.value;
        }
    }

    const parentPassRequest = parentPass.createTraversalRequest(ast);
    const parentPassResult = Traverse.traverseAst(parentPassRequest);
    if (parentPassResult.kind === ResultKind.Err) {
        return parentPassResult;
    }
    const parentMap = parentPassResult.value;

    const isMultilinePassResult = isMultilinePass.runMultipleTraversalRequests(ast, commentCollectionMap, parentMap);
    if (isMultilinePassResult.kind === ResultKind.Err) {
        return isMultilinePassResult;
    }
    const isMultilineMap = isMultilinePassResult.value;

    const serializerParameterPassRequest = serializerParameterPass.createTraversalRequest(
        ast,
        parentMap,
        commentCollectionMap,
        isMultilineMap,
    );
    const serializerParameterPassResult = Traverse.traverseAst(serializerParameterPassRequest);
    if (serializerParameterPassResult.kind === ResultKind.Err) {
        return serializerParameterPassResult;
    }
    const serializerParameterMap = serializerParameterPassResult.value;

    const maps: SerializerPassthroughMaps = {
        commentCollectionMap,
        serializerParameterMap,
    };
    const serializeRequest: SerializerRequest = {
        document: parseSuccess.ast,
        maps,
        options: formatRequest.options,
    }
    const serializeResult = Serializer.run(serializeRequest)
    return serializeResult;
}
