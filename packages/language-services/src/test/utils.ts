// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: Split this into a separate language-services-test package so it can be reused.

import { assert, expect } from "chai";
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

    public async getHover(identifier: string, context: HoverProviderContext): Promise<Hover> {
        const member: string | undefined = this.getMember(identifier);
        if (member) {
            return {
                contents: `member named '${member}`,
                range: context.range,
            };
        }

        return emptyHover;
    }

    public async getSignatureHelp(functionName: string, context: SignatureProviderContext): Promise<SignatureHelp> {
        const member: string | undefined = this.getMember(functionName);
        if (member) {
            return {
                signatures: [
                    {
                        label: member,
                        parameters: [],
                    },
                ],
                // tslint:disable-next-line: no-null-keyword
                activeParameter: context.argumentOrdinal ? context.argumentOrdinal : null,
                activeSignature: 0,
            };
        }

        return emptySignatureHelp;
    }

    public includeModules(_modules: string[]): void {
        throw new Error("Method not implemented.");
    }

    private getMember(value: string): string | undefined {
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
    const document: MockDocument = createDocument(text.replace("|", ""));
    const cursorPosition: Position = getPositionForMarker(text);

    const options: AnalysisOptions = analysisOptions ? analysisOptions : defaultAnalysisOptions;
    return createAnalysisSession(document, cursorPosition, options);
}

function getPositionForMarker(text: string): Position {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");

    const lines: string[] = text.split(/\r?\n/);
    let cursorLine: number = 0;
    let cursorCharacter: number = 0;
    for (let i: number = 0; i < lines.length; i += 1) {
        const markerIndex: number = lines[i].indexOf("|");
        if (markerIndex > 0) {
            cursorLine = i;
            cursorCharacter = markerIndex;
            break;
        }
    }

    return {
        line: cursorLine,
        character: cursorCharacter,
    };
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

export function containsCompletionItem(completionItems: CompletionItem[], label: string): CompletionItem | undefined {
    for (const item of completionItems) {
        if (item.label === label) {
            return item;
        }
    }

    assert.fail(`completion item '${label}' not found in array. Items: ${JSON.stringify(completionItems)}`);
    return undefined;
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
