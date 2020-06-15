import * as vscode from 'vscode';

import ConnectionController from '../connectionController';

function isSslConnection(activeConnectionModel: any): boolean {
  return !!(
    activeConnectionModel &&
    activeConnectionModel.driverOptions &&
    (activeConnectionModel.driverOptions.sslCA ||
      activeConnectionModel.driverOptions.sslCert ||
      activeConnectionModel.driverOptions.sslPass)
  );
}

function getSslOptions(driverOptions: any, isWindowsBasedShell: boolean): string[] {
  const mdbSslOptions = [ '--ssl' ];

  if (!driverOptions.checkServerIdentity) {
    mdbSslOptions.push('--sslAllowInvalidHostnames');
  }

  if (!driverOptions.sslValidate) {
    mdbSslOptions.push('--sslAllowInvalidCertificates');
  }

  if (driverOptions.sslCA) {
    mdbSslOptions.push(`--sslCAFile=${driverOptions.sslCA}`);
  }

  if (driverOptions.sslCert) {
    mdbSslOptions.push(`--sslPEMKeyFile=${driverOptions.sslCert}`);
  }

  if (driverOptions.sslPass) {
    mdbSslOptions.push(`--sslPEMKeyPassword=${isWindowsBasedShell ? '%MDB_SSL_CERTIFICATE_KEY_FILE_PASSWORD%' : '$MDB_SSL_CERTIFICATE_KEY_FILE_PASSWORD'}`);
  }

  return mdbSslOptions;
}

export default function openMongoDBShell(connectionController: ConnectionController): Promise<boolean> {
  const mongoDBShellEnv: any = {};
  let mdbSslOptions: string[] = [];

  if (
    !connectionController.isCurrentlyConnected()
  ) {
    vscode.window.showErrorMessage(
      'You need to be connected before launching the MongoDB Shell.'
    );

    return Promise.resolve(false);
  }

  const userShell = vscode.env.shell;
  const shellCommand: string | undefined = vscode.workspace.getConfiguration('mdb').get('shell');

  if (!userShell) {
    vscode.window.showErrorMessage(
      'Error: No shell found, please set your default shell environment in vscode.'
    );

    return Promise.resolve(false);
  }

  if (!shellCommand) {
    vscode.window.showErrorMessage(
      'No MongoDB shell command found. Please set the shell command in the MongoDB extension settings.'
    );
    return Promise.resolve(false);
  }

  const isWindowsBasedShell = userShell.includes('cmd.exe') || userShell.includes('powershell.exe');

  const activeConnectionModel = connectionController
    .getActiveConnectionModel()
    ?.getAttributes({ derived: true });

  const mdbConnectionString = activeConnectionModel
    ? activeConnectionModel.driverUrlWithSsh
    : '';

  if (activeConnectionModel && isSslConnection(activeConnectionModel)) {
    mdbSslOptions = getSslOptions(
      activeConnectionModel.driverOptions,
      isWindowsBasedShell
    );

    if (activeConnectionModel.driverOptions.sslPass) {
      mongoDBShellEnv.MDB_SSL_CERTIFICATE_KEY_FILE_PASSWORD =
        activeConnectionModel.driverOptions.sslPass;
    }
  }

  if (isWindowsBasedShell) {
    mongoDBShellEnv.MDB_CONNECTION_STRING = mdbConnectionString;

    const mongoDBShell = vscode.window.createTerminal({
      name: 'MongoDB Shell',
      env: mongoDBShellEnv
    });

    const mdbSslOptionsString = mdbSslOptions.length > 0
      ? `${mdbSslOptions.join(' ')} `
      : '';

    mongoDBShell.sendText(
      `${shellCommand} ${mdbSslOptionsString}%MDB_CONNECTION_STRING%;`
    );
    mongoDBShell.show();
  } else {
    // Assume it's a bash environment. This may fail on certain
    // shells but should cover most cases.
    const mongoDBShell = vscode.window.createTerminal({
      name: 'MongoDB Shell',
      shellPath: shellCommand,
      env: mongoDBShellEnv,
      shellArgs: [
        mdbConnectionString,
        ...mdbSslOptions
      ]
    });

    mongoDBShell.show();
  }

  return Promise.resolve(true);
}
