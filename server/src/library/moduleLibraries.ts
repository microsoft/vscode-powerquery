import * as PQLS from "@microsoft/powerquery-language-services";
import { TextDocument } from "vscode-languageserver-textdocument";

import { LibraryJson } from "./library";

export interface ModuleLibraryTrieNodeCache {
    localizedLibrary?: PQLS.Library.ILibrary;
}

export interface AddOneTextDocumentToModuleLibraryResultType {
    closestLibraryJson: LibraryJson;
    cache: ModuleLibraryTrieNodeCache;
}

class ModuleLibraryTrieNode {
    static defaultRoot: ModuleLibraryTrieNode = new ModuleLibraryTrieNode();

    public readonly cache: ModuleLibraryTrieNodeCache = {};
    public libraryJson?: LibraryJson;
    public textDocument?: TextDocument;

    public readonly children: Map<string, ModuleLibraryTrieNode> = new Map();

    constructor(private readonly parent?: ModuleLibraryTrieNode, private readonly currentPath: string = "") {}

    insert(paths: string[], visitorContext?: { closestLibraryJson: LibraryJson }): ModuleLibraryTrieNode {
        if (paths.length === 0) {
            return this;
        }

        const currentPath: string = paths[0];
        paths = paths.slice(1);

        let child: ModuleLibraryTrieNode;

        const maybeOneChild: ModuleLibraryTrieNode | undefined = this.children.get(currentPath);

        if (maybeOneChild) {
            child = maybeOneChild;

            if (visitorContext && child.libraryJson) {
                visitorContext.closestLibraryJson = child.libraryJson;
            }
        } else {
            child = new ModuleLibraryTrieNode(this, currentPath);
            this.children.set(currentPath, child);
        }

        return child.insert(paths, visitorContext);
    }

    remove(): void {
        if (this.parent) {
            this.parent.children.delete(this.currentPath);
        }
    }

    collectTextDocumentBeneath(visitorContext: { textDocuments: TextDocument[] }): void {
        for (const [, theNode] of this.children) {
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
    private readonly trieRoot: ModuleLibraryTrieNode = ModuleLibraryTrieNode.defaultRoot;
    private readonly openedTextDocumentTreeNodeMap: Map<string, ModuleLibraryTrieNode> = new Map();

    static splitUriPath(uriPath: string): string[] {
        return uriPath.split("/").filter(Boolean);
    }

    addOneModuleLibrary(uriPath: string, libraryJson: LibraryJson): TextDocument[] {
        const spitedPath: string[] = ModuleLibraries.splitUriPath(uriPath);
        const visitorContext: { textDocuments: [] } = { textDocuments: [] };
        const theNode: ModuleLibraryTrieNode = this.trieRoot.insert(spitedPath);
        theNode.libraryJson = libraryJson;
        theNode.collectTextDocumentBeneath(visitorContext);

        return visitorContext.textDocuments;
    }

    addOneTextDocument(textDocument: TextDocument): AddOneTextDocumentToModuleLibraryResultType {
        const spitedPath: string[] = ModuleLibraries.splitUriPath(textDocument.uri);
        const visitorContext: { closestLibraryJson: LibraryJson } = { closestLibraryJson: [] };
        const theNode: ModuleLibraryTrieNode = this.trieRoot.insert(spitedPath, visitorContext);
        theNode.textDocument = textDocument;
        this.openedTextDocumentTreeNodeMap.set(textDocument.uri, theNode);

        return {
            closestLibraryJson: visitorContext.closestLibraryJson,
            cache: theNode.cache,
        };
    }

    removeOneTextDocument(textDocument: TextDocument): void {
        const theDocUri: string = textDocument.uri;

        const maybeModuleLibraryTreeNode: ModuleLibraryTrieNode | undefined =
            this.openedTextDocumentTreeNodeMap.get(theDocUri);

        if (maybeModuleLibraryTreeNode) {
            this.openedTextDocumentTreeNodeMap.delete(theDocUri);
            maybeModuleLibraryTreeNode.remove();
        }
    }
}
