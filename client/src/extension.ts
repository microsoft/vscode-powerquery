// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import * as Commands from "./commands";
import { Constants } from "./constants";

const commands: vscode.Disposable[] = [];
let client: LC.LanguageClient;

export function activate(context: vscode.ExtensionContext): void {
    // Register commands
    commands.push(vscode.commands.registerTextEditorCommand(Constants.CommandEscapeMText, Commands.escapeMText));
    commands.push(vscode.commands.registerTextEditorCommand(Constants.CommandUnescapeMText, Commands.unescapeMText));
    commands.push(vscode.commands.registerTextEditorCommand(Constants.CommandEscapeJsonText, Commands.escapeJsonText));

    commands.push(
        vscode.commands.registerTextEditorCommand(Constants.CommandUnescapeJsonText, Commands.unescapeJsonText),
    );

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
}

export function deactivate(): Thenable<void> | undefined {
    if (commands.length > 0) {
        commands.forEach((disposable: vscode.Disposable) => disposable.dispose());
        commands.length = 0;
    }

    if (!client) {
        return undefined;
    }

    return client.stop();
}
