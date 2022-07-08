// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as vscode from "vscode";

import { CancellationToken, Position, TextDocument, TextEdit, WorkspaceEdit } from "vscode";

export function createRenameProvider(client: LC.LanguageClient): vscode.RenameProvider {
    return {
        async provideRenameEdits(
            textDocument: TextDocument,
            position: Position,
            newName: string,
            token: CancellationToken,
        ): Promise<WorkspaceEdit | undefined> {
            const textEdits: TextEdit[] = await client.sendRequest<TextEdit[]>("powerquery/renameIdentifier", {
                textDocumentUri: textDocument.uri.toString(),
                position,
                newName,
                token,
            });

            const res: WorkspaceEdit = new WorkspaceEdit();
            res.set(textDocument.uri, textEdits);

            return res;
        },
    };
}
