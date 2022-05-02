// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vs from "vscode";

import { CancellationToken, ExtensionContext, Position, TextDocument, TextEdit, WorkspaceEdit } from "vscode";

let client: LC.LanguageClient;

export function activate(context: ExtensionContext): void {
    // The server is implemented in node
    const serverModule: string = context.asAbsolutePath(path.join("server", "dist", "server.js"));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions: LC.ForkOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: LC.ServerOptions = {
        run: { module: serverModule, transport: LC.TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: LC.TransportKind.ipc,
            options: debugOptions,
        },
    };

    // Options to control the language client
    const clientOptions: LC.LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [
            {
                scheme: "file",
                language: "powerquery",
            },
            {
                scheme: "untitled",
                language: "powerquery",
            },
        ],
    };

    // Create the language client and start the client.
    client = new LC.LanguageClient("powerquery", "Power Query", serverOptions, clientOptions);

    // Start the client. This will also launch the server
    client.start();

    context.subscriptions.push(
        vs.languages.registerRenameProvider(
            { language: "powerquery" },
            {
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
            },
        ),
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }

    return client.stop();
}
