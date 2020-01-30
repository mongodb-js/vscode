// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { registerCommands } from './commands';
import { activate as createExplorerView } from './explorer';

// TODO: lucas: Future usage: shared state for across modules. Maybe. If needed. ;)
import { mdb } from './mdb';

// Called when our extension is activated.
// See "activationEvents" in `package.json` for the events that cause activation.
export function activate(context: vscode.ExtensionContext) {
    createExplorerView(context);

    // Register our extension's commands. These are the event handlers and control
    // the functionality of our extension.
    registerCommands(context);

    // TODO: Connect to any existing database connections.

    console.log('Congratulations, your extension "mongodb" is now active!');
}

// Called when our extension is deactivated.
export function deactivate() {
    // TODO: Close all active connections & end active queries/playgrounds.
}
