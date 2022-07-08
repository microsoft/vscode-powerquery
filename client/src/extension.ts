// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LC from "vscode-languageclient/node";
import * as path from "path";
import * as vscode from "vscode";

import * as CommandFn from "./commands";
import * as Subscriptions from "./subscriptions";
import { CommandConstant } from "./commandConstant";

const commands: vscode.Disposable[] = [];
let client: LC.LanguageClient;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Register commands
    commands.push(vscode.commands.registerTextEditorCommand(CommandConstant.EscapeJsonText, CommandFn.escapeJsonText));
    commands.push(vscode.commands.registerTextEditorCommand(CommandConstant.EscapeMText, CommandFn.escapeMText));

    commands.push(
        vscode.commands.registerTextEditorCommand(CommandConstant.UnescapeJsonText, CommandFn.unescapeJsonText),
    );

    commands.push(vscode.commands.registerTextEditorCommand(CommandConstant.UnescapeMText, CommandFn.unescapeMText));

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
    await client.start();

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: "powerquery" },
            Subscriptions.createDocumentSemanticTokensProvider(client),
            Subscriptions.SemanticTokensLegend,
        ),
    );

    context.subscriptions.push(
        vscode.languages.registerRenameProvider({ language: "powerquery" }, Subscriptions.createRenameProvider(client)),
    );
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
