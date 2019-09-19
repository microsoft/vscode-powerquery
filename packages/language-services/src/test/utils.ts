// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Range, Position, TextDocument } from "vscode-languageserver-types";

export function createDocument(text: string): TextDocument {
    return new MockDocument(text, "powerquery");
}

class MockDocument implements TextDocument {
    private static _nextUri: number = 0;

    private readonly _uri: string;
    private readonly _languageId: string;
    private readonly _text: string;

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

    set version(value: number) {
        this._version = value;
    }

    getText(range?: Range): string {
        if (range) {
            throw new Error("Method not implemented.");
        }

        return this._text;
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