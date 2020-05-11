// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ext } from './extensionConstants';
import { createLogger } from './logging';
const log = createLogger('extension.ts');

/**
 * Capture debug logs from mongodb-data-service, connection-model,
 * etc. and write them to the extension's log output channel too.
 */
import debug from 'debug';
debug.enable('INFO');
debug.enable('ERROR');
debug.enable('WARN');
debug.log = log.debug.bind(log);

import MDBExtensionController from './mdbExtensionController';

let mdbExtension: MDBExtensionController;

// Called when our extension is activated.
// See "activationEvents" in `package.json` for the events that cause activation.
export function activate(context: vscode.ExtensionContext): void {
  log.info('activate extension called');

  ext.context = context;
  mdbExtension = new MDBExtensionController(context);
  mdbExtension.activate();

  // Add our extension to a list of disposables for when we are deactivated.
  context.subscriptions.push(mdbExtension);

  log.info('extension activated');
}

// Called when our extension is deactivated.
export function deactivate(): void {
  if (mdbExtension) {
    mdbExtension.deactivate();
  }
}
