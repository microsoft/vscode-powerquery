// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import { Library, LibrarySymbol, LibrarySymbolUtils } from "@microsoft/powerquery-language-services";
import { PartialResult, PartialResultUtils } from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

import { LibraryDefinitionsGetter } from "./libraryTypeResolver";

export interface ModuleLibraryTrieNodeCache {
    localizedLibrary?: PQLS.Library.ILibrary;
}

export class ModuleLibraryTreeNode {
    static defaultRoot: ModuleLibraryTreeNode = new ModuleLibraryTreeNode();

    private _librarySymbols?: ReadonlyArray<LibrarySymbol.LibrarySymbol>;
    private _libraryDefinitions: ReadonlyMap<string, PQLS.Library.TLibraryDefinition> = new Map();
    public textDocument?: TextDocument;
    public readonly cache: ModuleLibraryTrieNodeCache = {};

    get isRoot(): boolean {
        return !this.parent;
    }

    get libraryJson(): ReadonlyArray<LibrarySymbol.LibrarySymbol> | undefined {
        return this._librarySymbols;
    }

    set libraryJson(val: ReadonlyArray<LibrarySymbol.LibrarySymbol> | undefined) {
        this._librarySymbols = val;
        this._libraryDefinitions = new Map();

        if (val && Array.isArray(val)) {
            const libraryDefinitionsResult: PartialResult<
                Library.LibraryDefinitions,
                Library.LibraryDefinitions,
                ReadonlyArray<LibrarySymbol.LibrarySymbol>
            > = LibrarySymbolUtils.createLibraryDefinitions(val);

            let libraryDefinitions: Library.LibraryDefinitions;
            let failedSymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>;

            if (PartialResultUtils.isOk(libraryDefinitionsResult)) {
                libraryDefinitions = libraryDefinitionsResult.value;
                failedSymbols = [];
            } else if (PartialResultUtils.isMixed(libraryDefinitionsResult)) {
                libraryDefinitions = libraryDefinitionsResult.value;
                failedSymbols = libraryDefinitionsResult.error;
            } else {
                libraryDefinitions = new Map();
                failedSymbols = libraryDefinitionsResult.error;
            }

            this._libraryDefinitions = libraryDefinitions;

            if (failedSymbols.length) {
                const csvSymbolNames: string = failedSymbols
                    .map((librarySymbol: LibrarySymbol.LibrarySymbol) => librarySymbol.name)
                    .join(", ");

                console.warn(
                    `$libraryJson.setter failed to create library definitions for the following symbolNames: ${csvSymbolNames}`,
                );
            }
        }
    }

    get libraryDefinitions(): PQLS.Library.LibraryDefinitions {
        return this._libraryDefinitions;
    }

    public libraryDefinitionsGetter: LibraryDefinitionsGetter = () => this.libraryDefinitions;

    public readonly children: Map<string, ModuleLibraryTreeNode> = new Map();

    constructor(private readonly parent?: ModuleLibraryTreeNode, private readonly currentPath: string = "") {}

    insert(
        paths: string[],
        visitorContext?: { closestModuleLibraryTreeNodeOfDefinitions: ModuleLibraryTreeNode },
    ): ModuleLibraryTreeNode {
        if (paths.length === 0) {
            return this;
        }

        const currentPath: string = paths[0];
        paths = paths.slice(1);

        let child: ModuleLibraryTreeNode;

        const maybeOneChild: ModuleLibraryTreeNode | undefined = this.children.get(currentPath);

        if (maybeOneChild) {
            child = maybeOneChild;

            if (visitorContext && child.libraryJson) {
                visitorContext.closestModuleLibraryTreeNodeOfDefinitions = child;
            }
        } else {
            child = new ModuleLibraryTreeNode(this, currentPath);
            this.children.set(currentPath, child);
        }

        return child.insert(paths, visitorContext);
    }

    remove(): void {
        if (this.parent) {
            this.parent.children.delete(this.currentPath);
        }

        this._libraryDefinitions = new Map();
        this._librarySymbols = [];
    }

    collectTextDocumentBeneath(visitorContext: { textDocuments: TextDocument[] }): void {
        for (const theNode of this.children.values()) {
            if (theNode.textDocument) {
                visitorContext.textDocuments.push(theNode.textDocument);
            } else {
                theNode.collectTextDocumentBeneath(visitorContext);
            }
        }
    }
}

/**
 * A mutable container of module libraries by uri path
 */
export class ModuleLibraries {
    private readonly trieRoot: ModuleLibraryTreeNode = ModuleLibraryTreeNode.defaultRoot;
    private readonly openedTextDocumentTreeNodeMap: Map<string, ModuleLibraryTreeNode> = new Map();

    static splitPath(uriPath: string): string[] {
        return uriPath.split("/").filter(Boolean);
    }

    addOneModuleLibrary(uriPath: string, libraryJson: ReadonlyArray<LibrarySymbol.LibrarySymbol>): TextDocument[] {
        const spitedPath: string[] = ModuleLibraries.splitPath(uriPath);
        const visitorContext: { textDocuments: [] } = { textDocuments: [] };
        const theNode: ModuleLibraryTreeNode = this.trieRoot.insert(spitedPath);
        theNode.libraryJson = libraryJson;
        theNode.collectTextDocumentBeneath(visitorContext);

        return visitorContext.textDocuments;
    }

    addOneTextDocument(textDocument: TextDocument): ModuleLibraryTreeNode {
        const spitedPath: string[] = ModuleLibraries.splitPath(textDocument.uri);

        const visitorContext: { closestModuleLibraryTreeNodeOfDefinitions: ModuleLibraryTreeNode } = {
            closestModuleLibraryTreeNodeOfDefinitions: this.trieRoot,
        };

        const theNode: ModuleLibraryTreeNode = this.trieRoot.insert(spitedPath, visitorContext);
        theNode.textDocument = textDocument;
        this.openedTextDocumentTreeNodeMap.set(textDocument.uri, theNode);

        return visitorContext.closestModuleLibraryTreeNodeOfDefinitions;
    }

    removeOneTextDocument(textDocument: TextDocument): void {
        const theDocUri: string = textDocument.uri;

        const maybeModuleLibraryTreeNode: ModuleLibraryTreeNode | undefined =
            this.openedTextDocumentTreeNodeMap.get(theDocUri);

        if (maybeModuleLibraryTreeNode) {
            this.openedTextDocumentTreeNodeMap.delete(theDocUri);
            maybeModuleLibraryTreeNode.remove();
        }
    }
}
