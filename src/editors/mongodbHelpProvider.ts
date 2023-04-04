import * as vscode from 'vscode';
import { TextDocument, Position } from 'vscode';

export default class MongodbHelpProvider implements vscode.SignatureHelpProvider {
	public static readonly triggerCharacters = [','];
	public static readonly retriggerCharacters = [','];

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public async provideSignatureHelp(document: TextDocument, position: Position): Promise<vscode.SignatureHelp | undefined> {
		const result = new vscode.SignatureHelp();
    const info = [{
      label: 'Collection.find(query, projection, options) : Cursor',
      documentation: undefined,
      parameters: []
    } /* , {
      label: 'Collection.find(query, projection, options) : Cursor',
      documentation: undefined,
      parameters: []
    } */ ];
		result.signatures = info;
		result.activeSignature = 0;
		result.activeParameter = 0;

		return Promise.resolve(result);
	}
}
