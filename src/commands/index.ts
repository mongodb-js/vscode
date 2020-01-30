import * as vscode from 'vscode';

import { createLogger } from '../logging';
const log = createLogger('commands');

const registerCommands = (context: vscode.ExtensionContext) => {
  console.group('registerCommands');

  console.log('context', context);
  vscode.commands.registerCommand('mdb.connect', (...args) => {
    console.log('connect', args);
    log.info('connect command called');
  });

  console.groupEnd();
};

export { registerCommands };
