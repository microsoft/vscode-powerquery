import { TokenRangeMap, Ast } from "@microsoft/powerquery-parser";

export type IsMultilineMap = TokenRangeMap<boolean>;

export function getIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap): boolean {
    return isMultilineMap[node.tokenRange.hash];
}

export function setIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap, isMultiline: boolean) {
    const cacheKey = node.tokenRange.hash;
    isMultilineMap[cacheKey] = isMultiline
}
