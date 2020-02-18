// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { createLogger } from './logging';

import MDBExtensionController from './mdbExtensionController';

let mdbExtension: MDBExtensionController;

const log = createLogger('commands');

// Called when our extension is activated.
// See "activationEvents" in `package.json` for the events that cause activation.
export function activate(context: vscode.ExtensionContext) {
  log.info('activate extension called');

  mdbExtension = new MDBExtensionController(context);

  // Add our extension to a list of disposables for when we are deactivated.
  context.subscriptions.push(mdbExtension);

  mdbExtension.activate();

  log.info('extension activated');
}

// Called when our extension is deactivated.
export function deactivate() {
  if (mdbExtension) {
    mdbExtension.deactivate();
  }
}
