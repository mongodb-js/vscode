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

function getSslOptions(driverOptions: any): string[] {
  const mdbSslOptions = ['--tls'];

  if (!driverOptions.checkServerIdentity) {
    mdbSslOptions.push('--tlsAllowInvalidHostnames');
  }

  if (!driverOptions.sslValidate) {
    mdbSslOptions.push('--tlsAllowInvalidCertificates');
  }

  if (driverOptions.sslCA) {
    mdbSslOptions.push(`--tlsCAFile="${driverOptions.sslCA}"`);
  }

  if (driverOptions.sslCert) {
    mdbSslOptions.push(`--tlsCertificateKeyFile="${driverOptions.sslCert}"`);
  }

  if (driverOptions.sslPass) {
    mdbSslOptions.push(`--tlsCertificateKeyFilePassword="${driverOptions.sslPass}"`);
  }

  return mdbSslOptions;
}

function launchMongoDBShellWithEnv(
  shellCommand: string,
  mdbConnectionString: string,
  mdbSslOptions: string[],
  envVariableString: string
) {
  const mongoDBShell = vscode.window.createTerminal({
    name: 'MongoDB Shell',
    env: {
      MDB_CONNECTION_STRING: mdbConnectionString
    }
  });

  const mdbSslOptionsString = mdbSslOptions.length > 0
    ? `${mdbSslOptions.join(' ')} `
    : '';

  mongoDBShell.sendText(
    `${shellCommand} ${mdbSslOptionsString}${envVariableString};`
  );
  mongoDBShell.show();
}

function launchMongoDBShellOnPowershell(
  shellCommand: string,
  mdbConnectionString: string,
  mdbSslOptions: string[]
): void {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, mdbSslOptions, '$Env:MDB_CONNECTION_STRING');
}

function launchMongoDBShellOnCmd(
  shellCommand: string,
  mdbConnectionString: string,
  mdbSslOptions: string[]
): void {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, mdbSslOptions, '%MDB_CONNECTION_STRING%');
}

function launchMongoDBShellOnGitBash(
  shellCommand: string,
  mdbConnectionString: string,
  mdbSslOptions: string[]
): void {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, mdbSslOptions, '$MDB_CONNECTION_STRING');
}

function launchMongoDBShellOnBash(
  shellCommand: string,
  mdbConnectionString: string,
  mdbSslOptions: string[]
): void {
  const mongoDBShell = vscode.window.createTerminal({
    name: 'MongoDB Shell',
    shellPath: shellCommand,
    shellArgs: [
      mdbConnectionString,
      ...mdbSslOptions
    ]
  });

  mongoDBShell.show();
}

export default function openMongoDBShell(connectionController: ConnectionController): Promise<boolean> {
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

  const activeConnectionModel = connectionController
    .getActiveConnectionModel()
    ?.getAttributes({ derived: true });

  const mdbConnectionString = activeConnectionModel
    ? activeConnectionModel.driverUrlWithSsh
    : '';

  if (activeConnectionModel && isSslConnection(activeConnectionModel)) {
    mdbSslOptions = getSslOptions(activeConnectionModel.driverOptions);
  }

  if (userShell.includes('powershell.exe')) {
    launchMongoDBShellOnPowershell(shellCommand, mdbConnectionString, mdbSslOptions);
  } else if (userShell.includes('cmd.exe')) {
    launchMongoDBShellOnCmd(shellCommand, mdbConnectionString, mdbSslOptions);
  } else if (userShell.toLocaleLowerCase().includes('git\\bin\\bash.exe')) {
    launchMongoDBShellOnGitBash(shellCommand, mdbConnectionString, mdbSslOptions);
  } else {
    // Assume it's a bash environment. This may fail on certain
    // shells but should cover most cases.
    launchMongoDBShellOnBash(shellCommand, mdbConnectionString, mdbSslOptions);
  }

  return Promise.resolve(true);
}
