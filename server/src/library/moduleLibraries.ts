// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQLS from "@microsoft/powerquery-language-services";
import { TextDocument } from "vscode-languageserver-textdocument";

import { LibraryExportJson, LibraryJson } from "./library";
import { LibraryDefinitionsGetter } from "./libraryTypeResolver";
import { mapExport } from "./libraryUtils";

export interface ModuleLibraryTrieNodeCache {
    localizedLibrary?: PQLS.Library.ILibrary;
}

export class ModuleLibraryTreeNode {
    static defaultRoot: ModuleLibraryTreeNode = new ModuleLibraryTreeNode();

    private _libraryJson?: LibraryJson;
    public textDocument?: TextDocument;
    private readonly _libraryDefinitions: Map<string, PQLS.Library.TLibraryDefinition> = new Map();
    public readonly cache: ModuleLibraryTrieNodeCache = {};

    get isRoot(): boolean {
        return !this.parent;
    }

    get libraryJson(): LibraryJson | undefined {
        return this._libraryJson;
    }

    set libraryJson(val: LibraryJson | undefined) {
        this._libraryJson = val;
        this._libraryDefinitions.clear();

        if (val && Array.isArray(val)) {
            val.forEach((xport: LibraryExportJson) => {
                this._libraryDefinitions.set(xport.name, mapExport(xport));
            });
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

        this._libraryDefinitions.clear();
        this._libraryJson = [];
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

    addOneModuleLibrary(uriPath: string, libraryJson: LibraryJson): TextDocument[] {
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
