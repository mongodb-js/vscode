// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ext } from './extensionConstants';
import { createLogger } from './logging';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json');

const log = createLogger('extension');

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
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  ext.context = context;

  const defaultConnectionSavingLocation = vscode.workspace
    .getConfiguration('mdb.connectionSaving')
    .get('defaultConnectionSavingLocation');

  log.info('123Activating extension...', {
    id: context.extension.id,
    version: version,
    mode: vscode.ExtensionMode[context.extensionMode],
    kind: vscode.ExtensionKind[context.extension.extensionKind],
    extensionPath: context.extensionPath,
    logPath: context.logUri.path,
    workspaceStoragePath: context.storageUri?.path,
    globalStoragePath: context.globalStorageUri.path,
    defaultConnectionSavingLocation,
    buildInfo: {
      nodeVersion: process.version,
      runtimePlatform: process.platform,
      runtimeArch: process.arch,
    },
  });

  mdbExtension = new MDBExtensionController(context, {
    shouldTrackTelemetry: true,
  });
  await mdbExtension.activate();

  // Add our extension to a list of disposables for when we are deactivated.
  context.subscriptions.push(mdbExtension);
}

// Called when our extension is deactivated.
export async function deactivate(): Promise<void> {
  log.info('Deactivating extension...');
  if (mdbExtension) {
    await mdbExtension.deactivate();
  }
}
