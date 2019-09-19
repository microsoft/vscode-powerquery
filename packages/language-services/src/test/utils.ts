// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { assert, expect } from "chai";
import { Diagnostic, DiagnosticSeverity, Position, Range, TextDocument } from "vscode-languageserver-types";

export function createDocument(text: string): MockDocument {
    return new MockDocument(text, "powerquery");
}

export class MockDocument implements TextDocument {
    private static _nextUri: number = 0;

    private readonly _uri: string;
    private readonly _languageId: string;

    private _text: string;
    private _version: number;

    constructor(text: string, languageId: string) {
        this._text = text;
        this._languageId = languageId;
        this._uri = MockDocument.getNextUri();
        this._version = 0;
    }

    get uri(): string {
        return this._uri;
    }

    get languageId(): string {
        return this._languageId;
    }

    get lineCount(): number {
        throw new Error("Method not implemented.");
    }

    get version(): number {
        return this._version;
    }

    getText(range?: Range): string {
        if (range) {
            throw new Error("getText with range not implemented.");
        }

        return this._text;
    }

    setText(text: string): void {
        this._text = text;
        this._version++;
    }

    positionAt(offset: number): Position {
        throw new Error("Method not implemented. Args: " + offset);
    }

    offsetAt(position: Position): number {
        throw new Error("Method not implemented. Args: " + JSON.stringify(position));
    }

    private static getNextUri(): string {
        return (MockDocument._nextUri++).toString();
    }
}

export function validateError(diagnostic: Diagnostic, startPosition: Position): void {
    assert.isDefined(diagnostic.message);
    assert.isDefined(diagnostic.range);
    expect(diagnostic.range.start).to.deep.equal(startPosition);
    expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
}

