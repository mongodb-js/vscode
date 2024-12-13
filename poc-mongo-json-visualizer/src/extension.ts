import * as vscode from 'vscode';
import { MongoJSONEditorProvider } from './mongoJSONEditor';

export function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  context.subscriptions.push(MongoJSONEditorProvider.register(context));
}
