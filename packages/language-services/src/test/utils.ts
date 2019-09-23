// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: Split this into a separate language-services-test package so it can be reused.

import { assert, expect } from "chai";
import {
    CompletionItem,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    TextDocument,
} from "vscode-languageserver-types";

export function createDocument(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

export function createDocumentWithCursor(text: string): MockDocument {
    expect(text).to.contain("|", "input string must contain a | to indicate cursor position");
    expect(text.indexOf("|")).to.equal(text.lastIndexOf("|"), "input string should only have one |");

    const lines: string[] = text.split(/\r?\n/);
    let cursorLine: number = 0;
    let cursorCharacter: number = 0;
    for (let i: number = 0; i < lines.length; i++) {
        const markerIndex: number = lines[i].indexOf("|");
        if (markerIndex > 0) {
            cursorLine = i;
            cursorCharacter = markerIndex;
            break;
        }
    }

    const document: MockDocument = createDocument(text.replace("|", ""));
    document.cursorPosition = {
        line: cursorLine,
        character: cursorCharacter,
    };

    return document;
}

// Adapted from vscode-languageserver-code implementation
export class MockDocument implements TextDocument {
    private static NextUri: number = 0;

    private readonly _uri: string;
    private readonly _languageId: string;

    private _cursorPosition: Position;
    private _content: string;
    private _lineOffsets: number[] | null;
    private _version: number;

    constructor(content: string, languageId: string) {
        this._content = content;
        this._cursorPosition = { line: 0, character: 0 };
        this._languageId = languageId;
        this._lineOffsets = null;
        this._uri = MockDocument.getNextUri();
        this._version = 0;
    }

    get cursorPosition(): Position {
        return this._cursorPosition;
    }

    set cursorPosition(position: Position) {
        this._cursorPosition = position;
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
            let start = this.offsetAt(range.start);
            let end = this.offsetAt(range.end);
            return this._content.substring(start, end);
        }
        return this._content;
    }

    public setText(text: string): void {
        this._content = text;
        this._lineOffsets = null;
        this._version++;
    }

    private getLineOffsets(): number[] {
        if (this._lineOffsets === null) {
            let lineOffsets: number[] = [];
            let text = this._content;
            let isLineStart = true;
            for (let i = 0; i < text.length; i++) {
                if (isLineStart) {
                    lineOffsets.push(i);
                    isLineStart = false;
                }
                let ch = text.charAt(i);
                isLineStart = ch === "\r" || ch === "\n";
                if (ch === "\r" && i + 1 < text.length && text.charAt(i + 1) === "\n") {
                    i++;
                }
            }
            if (isLineStart && text.length > 0) {
                lineOffsets.push(text.length);
            }
            this._lineOffsets = lineOffsets;
        }
        return this._lineOffsets;
    }

    public positionAt(offset: number) {
        offset = Math.max(Math.min(offset, this._content.length), 0);

        let lineOffsets = this.getLineOffsets();
        let low = 0,
            high = lineOffsets.length;
        if (high === 0) {
            return Position.create(0, offset);
        }
        while (low < high) {
            let mid = Math.floor((low + high) / 2);
            if (lineOffsets[mid] > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        // low is the least x for which the line offset is larger than the current offset
        // or array.length if no line offset is larger than the current offset
        let line = low - 1;
        return Position.create(line, offset - lineOffsets[line]);
    }

    public offsetAt(position: Position) {
        let lineOffsets = this.getLineOffsets();
        if (position.line >= lineOffsets.length) {
            return this._content.length;
        } else if (position.line < 0) {
            return 0;
        }
        let lineOffset = lineOffsets[position.line];
        let nextLineOffset =
            position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : this._content.length;
        return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
    }

    public get lineCount() {
        return this.getLineOffsets().length;
    }

    private static getNextUri(): string {
        return (MockDocument.NextUri++).toString();
    }
}

export function validateError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

export function containsCompletionItem(completionItems: CompletionItem[], label: string): void {

    for (let i = 0; i < completionItems.length; i++) {
        const item = completionItems[i];
        if (item.label === label) {
            return;
        }
    }

    assert.fail(`completion item '${label}' not found in array. Items: ` + JSON.stringify(completionItems));
}
