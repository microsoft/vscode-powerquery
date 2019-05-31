import { Ast, Option, TokenRangeMap, CommonError } from "@microsoft/powerquery-parser";

export type IsMultilineMap = TokenRangeMap<boolean>;

export function expectGetIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap): boolean {
    const maybeIsMultiline: Option<boolean> = isMultilineMap.get(node.tokenRange.hash);
    if (maybeIsMultiline === undefined) {
        throw new CommonError.InvariantError(`isMultiline is missing for TokenRange ${node.tokenRange.hash}`);
    }
    const isMultiline: boolean = maybeIsMultiline;

    return isMultiline;
}

export function setIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap, isMultiline: boolean) {
    const cacheKey = node.tokenRange.hash;
    isMultilineMap.set(cacheKey, isMultiline);
}
