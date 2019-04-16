import * as vscode from 'vscode';
import { PowerQueryEditProvider } from "./editProvider";

export function activate(context: vscode.ExtensionContext) {
	const selector: vscode.DocumentSelector = [
		{
			language: "powerquery",
			scheme: "file",
		},
		{
			language: "powerquery",
			scheme: "untitled",
		},
	]
	const editProvider = new PowerQueryEditProvider();
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider(selector, editProvider),
	);
}

export function deactivate() { }
