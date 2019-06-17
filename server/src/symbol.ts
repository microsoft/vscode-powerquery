// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LineToken } from "@microsoft/powerquery-parser";
import { LibraryDefinition } from "powerquery-library";

export class DocumentSymbol {
    constructor(public readonly token: LineToken, public readonly definition: LibraryDefinition | undefined) {}
}
