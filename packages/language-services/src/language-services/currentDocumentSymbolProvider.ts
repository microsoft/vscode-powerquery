// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import {
    CompletionItem,
    DocumentSymbol,
    Hover,
    Position,
    SignatureHelp,
    TextDocument,
} from "vscode-languageserver-types";

import * as Common from "./common";
import * as InspectionHelpers from "./inspectionHelpers";
import {
    CompletionItemProviderContext,
    HoverProviderContext,
    SignatureProviderContext,
    SymbolProvider,
} from "./providers";
import * as WorkspaceCache from "./workspaceCache";

export class CurrentDocumentSymbolProvider implements SymbolProvider {
    private readonly document: TextDocument;
    private readonly position: Position;

    private documentSymbols: DocumentSymbol[] | undefined;

    constructor(textDocument: TextDocument, position: Position) {
        this.document = textDocument;
        this.position = position;
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

            const triedInspection: PQP.Inspection.TriedInspection | undefined = WorkspaceCache.getTriedInspection(
                this.document,
                this.position,
            );

            if (triedInspection && triedInspection.kind === PQP.ResultKind.Ok) {
                const inspected: PQP.Inspection.Inspected = triedInspection.value;
                this.documentSymbols = InspectionHelpers.getSymbolsForInspectionScope(inspected);
            }
        }

        return this.documentSymbols;
    }
}
