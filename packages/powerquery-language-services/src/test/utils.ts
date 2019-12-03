// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: Split this into a separate language-services-test package so it can be reused.
import * as PQP from "@microsoft/powerquery-parser";
import { assert, expect } from "chai";
import * as File from "fs";
import * as Path from "path";
import {
    CompletionItem,
    CompletionItemKind,
    Diagnostic,
    DiagnosticSeverity,
    Hover,
    Position,
    Range,
    SignatureHelp,
    TextDocument,
} from "vscode-languageserver-types";

import {
    Analysis,
    AnalysisOptions,
    CompletionItemProviderContext,
    createAnalysisSession,
    HoverProviderContext,
    LibrarySymbolProvider,
    NullLibrarySymbolProvider,
    SignatureProviderContext,
} from "../language-services";
import * as WorkspaceCache from "../language-services/workspaceCache";

class ErrorLibraryProvider extends NullLibrarySymbolProvider {
    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        throw new Error("error provider always errors");
    }
}

export class SimpleLibraryProvider implements LibrarySymbolProvider {
    private readonly members: string[];

    constructor(members: string[]) {
        this.members = members;
    }

    public async getCompletionItems(_context: CompletionItemProviderContext): Promise<CompletionItem[]> {
        const result: CompletionItem[] = [];
        this.members.forEach(member => {
            result.push({
                kind: CompletionItemKind.Function,
                label: member,
            });
        });

        return result;
    }

    public async getHover(context: HoverProviderContext): Promise<Hover> {
        const member: string | undefined = this.getMember(context.identifier);
        if (member) {
            return {
                contents: `member named '${member}`,
                range: context.range,
            };
        }

        return emptyHover;
    }

    public async getSignatureHelp(context: SignatureProviderContext): Promise<SignatureHelp> {
        const member: string | undefined = this.getMember(context.maybeFunctionName);
        if (member) {
            return {
                signatures: [
                    {
                        label: member,
                        parameters: [],
                    },
                ],
                // tslint:disable-next-line: no-null-keyword
                activeParameter: context.maybeArgumentOrdinal ? context.maybeArgumentOrdinal : null,
                activeSignature: 0,
            };
        }

        return emptySignatureHelp;
    }

    public includeModules(_modules: string[]): void {
        throw new Error("Method not implemented.");
    }

    private getMember(value: undefined | string): undefined | string {
        if (value === undefined) {
            return undefined;
        }

        return this.members.find((member: string) => {
            return value === member;
        });
    }
}

const defaultAnalysisOptions: AnalysisOptions = {};

export const errorAnalysisOptions: AnalysisOptions = {
    librarySymbolProvider: new ErrorLibraryProvider(),
};

export function createDocument(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

export function createDocumentFromFile(fileName: string): MockDocument {
    const fullPath: string = Path.join(Path.dirname(__filename), "files", fileName);
    assert.isTrue(File.existsSync(fullPath), `file ${fullPath} not found.`);

    let contents: string = File.readFileSync(fullPath, "utf8");
    contents = contents.replace(/^\uFEFF/, "");

    return new MockDocument(contents, "powerquery");
}

export function createDocumentWithMarker(text: string): [MockDocument, Position] {
    validateTextWithMarker(text);
    const document: MockDocument = createDocument(text.replace("|", ""));
    const cursorPosition: Position = document.positionAt(text.indexOf("|"));

    return [document, cursorPosition];
}

export function getInspection(text: string): PQP.Inspection.Inspected {
    const [document, cursorPosition] = createDocumentWithMarker(text);
    const triedInspect: PQP.Inspection.TriedInspection | undefined = WorkspaceCache.getTriedInspection(
        document,
        cursorPosition,
    );

    assert.isDefined(triedInspect);
    // tslint:disable-next-line: no-unnecessary-type-assertion
    expect(triedInspect!.kind).equals(PQP.ResultKind.Ok);

    if (triedInspect && triedInspect.kind === PQP.ResultKind.Ok) {
        return triedInspect.value;
    }

    throw new Error("unexpected");
}

export async function getCompletionItems(text: string, analysisOptions?: AnalysisOptions): Promise<CompletionItem[]> {
    return createAnalysis(text, analysisOptions).getCompletionItems();
}

export async function getHover(text: string, analysisOptions?: AnalysisOptions): Promise<Hover> {
    return createAnalysis(text, analysisOptions).getHover();
}

export async function getSignatureHelp(text: string, analysisOptions?: AnalysisOptions): Promise<SignatureHelp> {
    return createAnalysis(text, analysisOptions).getSignatureHelp();
}

function createAnalysis(text: string, analysisOptions?: AnalysisOptions): Analysis {
    const [document, cursorPosition] = createDocumentWithMarker(text);
    const options: AnalysisOptions = analysisOptions ? analysisOptions : defaultAnalysisOptions;
    return createAnalysisSession(document, cursorPosition, options);
}

function validateTextWithMarker(text: string): void {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");
}

// Adapted from vscode-languageserver-code implementation
export class MockDocument implements TextDocument {
    private static NextUri: number = 0;

    private readonly _uri: string;
    private readonly _languageId: string;

    private _content: string;
    private _lineOffsets: number[] | undefined;
    private _version: number;

    constructor(content: string, languageId: string) {
        this._content = content;
        this._languageId = languageId;
        this._uri = MockDocument.getNextUri();
        this._version = 0;
    }

    public get uri(): string {
        return this._uri;
    }

    public get languageId(): string {
        return this._languageId;
    }

    public get version(): number {
        return this._version;
    }

    public getText(range?: Range): string {
        if (range) {
            const start: number = this.offsetAt(range.start);
            const end: number = this.offsetAt(range.end);
            return this._content.substring(start, end);
        }
        return this._content;
    }

    public setText(text: string): void {
        this._content = text;
        this._lineOffsets = undefined;
        this._version += 1;
    }

    public offsetAt(position: Position): number {
        const lineOffsets: number[] = this.getLineOffsets();
        if (position.line >= lineOffsets.length) {
            return this._content.length;
        } else if (position.line < 0) {
            return 0;
        }
        const lineOffset: number = lineOffsets[position.line];
        const nextLineOffset: number =
            position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
        return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
    }

    public positionAt(offset: number): Position {
        offset = Math.max(Math.min(offset, this._content.length), 0);

        const lineOffsets: number[] = this.getLineOffsets();
        let low: number = 0;
        let high: number = lineOffsets.length;
        if (high === 0) {
            return Position.create(0, offset);
        }
        while (low < high) {
            const mid: number = Math.floor((low + high) / 2);
            if (lineOffsets[mid] > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        // low is the least x for which the line offset is larger than the current offset
        // or array.length if no line offset is larger than the current offset
        const line: number = low - 1;
        return Position.create(line, offset - lineOffsets[line]);
    }

    public get lineCount(): number {
        return this.getLineOffsets().length;
    }

    private static getNextUri(): string {
        MockDocument.NextUri += 1;
        return MockDocument.NextUri.toString();
    }

    private getLineOffsets(): number[] {
        if (this._lineOffsets === undefined) {
            const lineOffsets: number[] = [];
            const text: string = this._content;
            let isLineStart: boolean = true;
            for (let i: number = 0; i < text.length; i += 1) {
                if (isLineStart) {
                    lineOffsets.push(i);
                    isLineStart = false;
                }
                const ch: string = text.charAt(i);
                isLineStart = ch === "\r" || ch === "\n";
                if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === "\n") {
                    i += 1;
                }
            }
            if (isLineStart && text.length > 0) {
                lineOffsets.push(text.length);
            }
            this._lineOffsets = lineOffsets;
        }
        return this._lineOffsets;
    }
}

export function validateError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

export function containsCompletionItem(completionItems: CompletionItem[], label: string): void {
    for (const item of completionItems) {
        if (item.label === label) {
            return;
        }
    }

    assert.fail(`completion item '${label}' not found in array. Items: ${JSON.stringify(completionItems)}`);
}

export function containsCompletionItems(completionItems: CompletionItem[], labels: string[]): void {
    const actualCompletionItemLabels: string[] = completionItems.map(value => {
        return value.label;
    });

    expect(actualCompletionItemLabels).to.contain.members(labels);
}

export const emptyCompletionItems: CompletionItem[] = [];

export const emptyHover: Hover = {
    range: undefined,
    contents: [],
};

export const emptySignatureHelp: SignatureHelp = {
    signatures: [],
    // tslint:disable-next-line: no-null-keyword
    activeParameter: null,
    activeSignature: 0,
};

export function dumpNodeToTraceFile(node: PQP.Ast.INode, filePath: string): void {
    const asJson: string = JSON.stringify(node);
    File.writeFileSync(filePath, asJson);
}
