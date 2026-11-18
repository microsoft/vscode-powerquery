// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";
import * as PQF from "@microsoft/powerquery-formatter";
import * as PQLS from "@microsoft/powerquery-language-services";
import * as PQP from "@microsoft/powerquery-parser";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DefaultServerSettings, ServerSettings, SettingsUtils } from "../settings";

function createDocument(text: string): TextDocument {
    return TextDocument.create("file:///formatting.pq", "powerquery", 1, text);
}

function createSettings(
    text: string,
    insertSpaces: boolean,
    tabSize: number = 4,
    cancellationToken?: LS.CancellationToken,
    locale: string = PQP.DefaultLocale,
): PQF.FormatSettings {
    const serverSettings: ServerSettings = {
        ...DefaultServerSettings,
        locale,
    };

    return SettingsUtils.createFormattingSettings(
        createDocument(text),
        {
            insertSpaces,
            tabSize,
        },
        cancellationToken,
        serverSettings,
    );
}

describe("formatting", () => {
    it("uses the configured locale", () => {
        const settings: PQF.FormatSettings = createSettings("let x = 1 in x", true, 4, undefined, "fr-FR");

        expect(settings.locale).to.equal("fr-FR");
    });

    it("maps insertSpaces to four spaces or tabs regardless of tabSize", () => {
        expect(createSettings("let x = 1 in x", true, 2).indentationLiteral).to.equal(PQF.IndentationLiteral.SpaceX4);

        expect(createSettings("let x = 1 in x", true, 8).indentationLiteral).to.equal(PQF.IndentationLiteral.SpaceX4);

        expect(createSettings("let x = 1 in x", false, 8).indentationLiteral).to.equal(PQF.IndentationLiteral.Tab);
    });

    it("uses the document's line endings and defaults to the formatter policy", () => {
        expect(createSettings("let\r\nx = 1\r\nin x", true).newlineLiteral).to.equal(PQF.NewlineLiteral.Windows);
        expect(createSettings("let\nx = 1\nin x", true).newlineLiteral).to.equal(PQF.NewlineLiteral.Unix);
        expect(createSettings("let x = 1 in x", true).newlineLiteral).to.equal(PQF.DefaultSettings.newlineLiteral);
    });

    it("preserves language server cancellation", () => {
        const cancellationTokenSource: LS.CancellationTokenSource = new LS.CancellationTokenSource();

        const settings: PQF.FormatSettings = createSettings("let x = 1 in x", true, 4, cancellationTokenSource.token);

        cancellationTokenSource.cancel();

        expect(settings.cancellationToken?.isCancelled()).to.equal(true);
    });

    it("formats with the mapped indentation and newline options", async () => {
        const document: TextDocument = createDocument(
            "let\r\nx = [aVeryLongIdentifier = 1, anotherVeryLongIdentifier = 2]\r\nin x",
        );

        const settings: PQF.FormatSettings = SettingsUtils.createFormattingSettings(
            document,
            {
                insertSpaces: false,
                tabSize: 8,
                trimTrailingWhitespace: true,
            },
            undefined,
        );

        const result: PQP.Result<LS.TextEdit[] | undefined, PQP.CommonError.CommonError> = await PQLS.tryFormat(
            document,
            {
                ...settings,
                maxWidth: 20,
            },
        );

        PQP.ResultUtils.assertIsOk(result);
        expect(result.value).to.have.length(1);

        expect(result.value?.[0].newText).to.equal(
            "let\r\n\tx = [\r\n\t\taVeryLongIdentifier = 1,\r\n\t\tanotherVeryLongIdentifier = 2\r\n\t]\r\nin\r\n\tx\r\n",
        );
    });
});
