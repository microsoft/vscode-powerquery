// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { CompletionItem, DocumentSymbol, Hover, SignatureHelp, TextDocument } from "vscode-languageserver-types";

import * as Common from "./common";
import * as InspectionHelpers from "./inspectionHelpers";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    SignatureProviderContext,
    SymbolProvider,
} from "./providers";
import * as WorkspaceCache from "./workspaceCache";

// TODO: we can improve this logic by using the Inspect/Traverse classes.
export class CurrentDocumentSymbolProvider implements SymbolProvider {
    private readonly document: TextDocument;

    private documentSymbols: DocumentSymbol[] | undefined;

    constructor(textDocument: TextDocument) {
        this.document = textDocument;
    }

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        return Common.documentSymbolToCompletionItem(this.getDocumentSymbols());
    }

    public async getHover(_context: HoverProviderContext): Promise<Hover | null> {
        // TODO: implement - documentSymbols should be a map
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    public async getSignatureHelp(_context: SignatureProviderContext): Promise<SignatureHelp | null> {
        // TODO: store parser/node info so we can reconstruct the function parameters
        // tslint:disable-next-line: no-null-keyword
        return null;
    }

    private getDocumentSymbols(): DocumentSymbol[] {
        if (this.documentSymbols === undefined) {
            this.documentSymbols = [];

            const rootNode: PQP.Ast.TDocument | undefined = WorkspaceCache.getRootNodeForDocument(this.document);
            if (rootNode) {
                if (rootNode.kind === PQP.Ast.NodeKind.Section) {
                    this.documentSymbols = InspectionHelpers.getSymbolsForSection(rootNode);
                } else if (rootNode.kind === PQP.Ast.NodeKind.LetExpression) {
                    this.documentSymbols = InspectionHelpers.getSymbolsForLetExpression(rootNode);
                }

                // TODO: are there other cases we need to handle?
            }
        }

        return this.documentSymbols;
    }
}
