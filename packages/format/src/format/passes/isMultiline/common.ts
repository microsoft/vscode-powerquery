import { Ast, CommonError, Option, TokenRangeMap } from "@microsoft/powerquery-parser";

export type IsMultilineMap = TokenRangeMap<boolean>;

export function expectGetIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap): boolean {
    const maybeIsMultiline: Option<boolean> = isMultilineMap.get(node.tokenRange.hash);
    if (maybeIsMultiline === undefined) {
        throw new CommonError.InvariantError(`isMultiline is missing for TokenRange ${node.tokenRange.hash}`);
    }

    return maybeIsMultiline;
}

export function setIsMultiline(node: Ast.TNode, isMultilineMap: IsMultilineMap, isMultiline: boolean): void {
    const cacheKey: string = node.tokenRange.hash;
    isMultilineMap.set(cacheKey, isMultiline);
}
