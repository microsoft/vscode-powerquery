// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import { Library, LibrarySymbol, LibrarySymbolUtils } from "@microsoft/powerquery-language-services";
import { PartialResult, PartialResultUtils } from "@microsoft/powerquery-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

export interface ModuleLibraryTrieNodeCache {
    localizedLibrary?: PQLS.Library.ILibrary;
}

export class ModuleLibraryTreeNode {
    static defaultRoot: ModuleLibraryTreeNode = new ModuleLibraryTreeNode();

    private _librarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol> | undefined;
    private _staticLibraryDefinitions: ReadonlyMap<string, PQLS.Library.TLibraryDefinition> = new Map();
    public textDocument?: TextDocument;
    public readonly cache: ModuleLibraryTrieNodeCache = {};

    get isRoot(): boolean {
        return !this.parent;
    }

    get libraryJson(): ReadonlyArray<LibrarySymbol.LibrarySymbol> | undefined {
        return this._librarySymbols;
    }

    set libraryJson(librarySymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol> | undefined) {
        this._librarySymbols = librarySymbols;
        this._staticLibraryDefinitions = new Map();

        if (librarySymbols) {
            const libraryDefinitionsResult: PartialResult<
                ReadonlyMap<string, Library.TLibraryDefinition>,
                LibrarySymbolUtils.IncompleteLibraryDefinitions,
                ReadonlyArray<LibrarySymbol.LibrarySymbol>
            > = LibrarySymbolUtils.createLibraryDefinitions(librarySymbols);

            let staticLibraryDefinitions: ReadonlyMap<string, Library.TLibraryDefinition>;
            let failedSymbols: ReadonlyArray<LibrarySymbol.LibrarySymbol>;

            if (PartialResultUtils.isOk(libraryDefinitionsResult)) {
                staticLibraryDefinitions = libraryDefinitionsResult.value;
                failedSymbols = [];
            } else if (PartialResultUtils.isIncomplete(libraryDefinitionsResult)) {
                staticLibraryDefinitions = libraryDefinitionsResult.partial.libraryDefinitions;
                failedSymbols = libraryDefinitionsResult.partial.invalidSymbols;
            } else {
                staticLibraryDefinitions = new Map();
                failedSymbols = libraryDefinitionsResult.error;
            }

            this._staticLibraryDefinitions = staticLibraryDefinitions;

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

    get libraryDefinitions(): () => ReadonlyMap<string, Library.TLibraryDefinition> {
        return () => this._staticLibraryDefinitions;
    }

    public readonly children: Map<string, ModuleLibraryTreeNode> = new Map();

    constructor(private readonly parent?: ModuleLibraryTreeNode, private readonly currentPath: string = "") {}

    insert(
        paths: ReadonlyArray<string>,
        visitorContext?: { closestModuleLibraryTreeNodeOfDefinitions: ModuleLibraryTreeNode },
    ): ModuleLibraryTreeNode {
        if (paths.length === 0) {
            return this;
        }

        const currentPath: string = paths[0];
        paths = paths.slice(1);

        let child: ModuleLibraryTreeNode;

        const maybeChild: ModuleLibraryTreeNode | undefined = this.children.get(currentPath);

        if (maybeChild) {
            child = maybeChild;

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

        this._staticLibraryDefinitions = new Map();
        this._librarySymbols = [];
    }

    collectTextDocumentBeneath(visitorContext: { textDocuments: TextDocument[] }): void {
        for (const node of this.children.values()) {
            if (node.textDocument) {
                visitorContext.textDocuments.push(node.textDocument);
            } else {
                node.collectTextDocumentBeneath(visitorContext);
            }
        }
    }
}

/**
 * A mutable container of module libraries by uri path
 */
export class ModuleLibraries {
    private readonly root: ModuleLibraryTreeNode = ModuleLibraryTreeNode.defaultRoot;
    private readonly moduleLibraryTreeNodeByTextDocumentUri: Map<string, ModuleLibraryTreeNode> = new Map();

    static splitPath(uriPath: string): ReadonlyArray<string> {
        return uriPath.split("/").filter(Boolean);
    }

    addModuleLibrary(uriPath: string, libraryJson: ReadonlyArray<LibrarySymbol.LibrarySymbol>): TextDocument[] {
        const splittedPath: ReadonlyArray<string> = ModuleLibraries.splitPath(uriPath);
        const visitorContext: { textDocuments: [] } = { textDocuments: [] };
        const node: ModuleLibraryTreeNode = this.root.insert(splittedPath);
        node.libraryJson = libraryJson;
        node.collectTextDocumentBeneath(visitorContext);

        return visitorContext.textDocuments;
    }

    addTextDocument(textDocument: TextDocument): ModuleLibraryTreeNode {
        const splittedPath: ReadonlyArray<string> = ModuleLibraries.splitPath(textDocument.uri);

        const visitorContext: { closestModuleLibraryTreeNodeOfDefinitions: ModuleLibraryTreeNode } = {
            closestModuleLibraryTreeNodeOfDefinitions: this.root,
        };

        const theNode: ModuleLibraryTreeNode = this.root.insert(splittedPath, visitorContext);
        theNode.textDocument = textDocument;
        this.moduleLibraryTreeNodeByTextDocumentUri.set(textDocument.uri, theNode);

        return visitorContext.closestModuleLibraryTreeNodeOfDefinitions;
    }

    removeTextDocument(textDocument: TextDocument): void {
        const uri: string = textDocument.uri;

        const moduleLibraryTreeNode: ModuleLibraryTreeNode | undefined =
            this.moduleLibraryTreeNodeByTextDocumentUri.get(uri);

        if (moduleLibraryTreeNode) {
            this.moduleLibraryTreeNodeByTextDocumentUri.delete(uri);
            moduleLibraryTreeNode.remove();
        }
    }

    // Used for testing.
    getLibraryCount(): number {
        let count: number = 0;

        this.root.children.forEach((node: ModuleLibraryTreeNode) => {
            count += node.libraryJson?.length ?? 0;
        });

        return count;
    }
}
