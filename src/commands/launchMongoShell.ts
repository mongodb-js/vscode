import * as vscode from 'vscode';

import ConnectionController from '../connectionController';

const launchMongoDBShellWithEnv = (
  shellCommand: string,
  mdbConnectionString: string,
  envVariableString: string
) => {
  const mongoDBShell = vscode.window.createTerminal({
    name: 'MongoDB Shell',
    env: {
      MDB_CONNECTION_STRING: mdbConnectionString
    }
  });

  mongoDBShell.sendText(
    `${shellCommand} ${envVariableString};`
  );
  mongoDBShell.show();
};

const launchMongoDBShellOnPowershell = (
  shellCommand: string,
  mdbConnectionString: string
): void => {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, '$Env:MDB_CONNECTION_STRING');
};

const launchMongoDBShellOnCmd = (
  shellCommand: string,
  mdbConnectionString: string
): void => {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, '%MDB_CONNECTION_STRING%');
};

const launchMongoDBShellOnGitBash = (
  shellCommand: string,
  mdbConnectionString: string
): void => {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, '$MDB_CONNECTION_STRING');
};

const launchMongoDBShellOnBash = (
  shellCommand: string,
  mdbConnectionString: string
): void => {
  launchMongoDBShellWithEnv(shellCommand, mdbConnectionString, '$MDB_CONNECTION_STRING');
};

const openMongoDBShell = (connectionController: ConnectionController): Promise<boolean> => {
  if (
    !connectionController.isCurrentlyConnected()
  ) {
    void vscode.window.showErrorMessage(
      'You need to be connected before launching the MongoDB Shell.'
    );

    return Promise.resolve(false);
  }

  const userShell = vscode.env.shell;
  const shellCommand: string | undefined = vscode.workspace.getConfiguration('mdb').get('shell');

  if (!userShell) {
    void vscode.window.showErrorMessage(
      'Error: No shell found, please set your default shell environment in vscode.'
    );

    return Promise.resolve(false);
  }

  if (!shellCommand) {
    void vscode.window.showErrorMessage(
      'No MongoDB shell command found. Please set the shell command in the MongoDB extension settings.'
    );
    return Promise.resolve(false);
  }

  const activeMongoClientOptions = connectionController.getMongoClientConnectionOptions();

  if (!activeMongoClientOptions) {
    void vscode.window.showErrorMessage(
      'No active connection found.'
    );

    return Promise.resolve(false);
  }

  const mdbConnectionString = activeMongoClientOptions.url || '';

  if (userShell.includes('powershell.exe')) {
    launchMongoDBShellOnPowershell(shellCommand, mdbConnectionString);
  } else if (userShell.includes('cmd.exe')) {
    launchMongoDBShellOnCmd(shellCommand, mdbConnectionString);
  } else if (userShell.toLocaleLowerCase().includes('git\\bin\\bash.exe')) {
    launchMongoDBShellOnGitBash(shellCommand, mdbConnectionString);
  } else {
    // Assume it's a bash environment. This may fail on certain
    // shells but should cover most cases.
    launchMongoDBShellOnBash(shellCommand, mdbConnectionString);
  }

  return Promise.resolve(true);
};

export default openMongoDBShell;
