// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { activate as createExplorerView } from './explorer';

import MDBExtensionController from './mdbExtensionController';

let mdbExtension: MDBExtensionController;

// Called when our extension is activated.
// See "activationEvents" in `package.json` for the events that cause activation.
export function activate(context: vscode.ExtensionContext) {
  mdbExtension = new MDBExtensionController();

  // Add our extension to a list of disposables for when we are deactivated.
  context.subscriptions.push(mdbExtension);

  mdbExtension.activate(context);

  createExplorerView(context);

  console.log('Congratulations, your extension "mongodb" is now active!');
}

// Called when our extension is deactivated.
export function deactivate() {
  if (mdbExtension) {
    mdbExtension.deactivate();
  }
}
