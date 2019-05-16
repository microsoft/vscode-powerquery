import { LineToken } from '@microsoft/powerquery-parser';
import { LibraryDefinition } from 'powerquery-library';

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export class DocumentSymbol {
	public readonly token: LineToken;
	public readonly definition: LibraryDefinition | undefined;

	constructor(token: LineToken, definition: LibraryDefinition | undefined) {
		this.token = token;
		this.definition = definition;
	}
}