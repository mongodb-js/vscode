import * as vscode from 'vscode';

import type ConnectionController from '../connectionController';

const launchMongoDBShellWithEnv = ({
  shellCommand,
  mdbConnectionString,
  envVariableString,
  parentHandle,
}: {
  shellCommand: string;
  mdbConnectionString: string;
  envVariableString: string;
  parentHandle?: string;
}): void => {
  const mongoDBShell = vscode.window.createTerminal({
    name: 'MongoDB Shell',
    env: {
      MDB_CONNECTION_STRING: mdbConnectionString,
      ...(parentHandle
        ? {
            MONGOSH_OIDC_PARENT_HANDLE: parentHandle, // For OIDC to share the state and avoid extra logins.
          }
        : {}),
    },
  });

  mongoDBShell.sendText(`${shellCommand} ${envVariableString};`);
  mongoDBShell.show();
};

const getPowershellEnvString = (): string => {
  return '$Env:MDB_CONNECTION_STRING';
};

const getCmdEnvString = (): string => {
  return '%MDB_CONNECTION_STRING%';
};

const getGitBashEnvString = (): string => {
  return '$MDB_CONNECTION_STRING';
};

const getBashEnvString = (): string => {
  return '$MDB_CONNECTION_STRING';
};

const openMongoDBShell = (
  connectionController: ConnectionController
): Promise<boolean> => {
  if (!connectionController.isCurrentlyConnected()) {
    void vscode.window.showErrorMessage(
      'You need to be connected before launching the MongoDB Shell.'
    );
    return Promise.resolve(false);
  }

  const userShell = vscode.env.shell;
  const shellCommand: string | undefined = vscode.workspace
    .getConfiguration('mdb')
    .get('shell');

  if (!userShell) {
    void vscode.window.showErrorMessage(
      'No shell found, please set your default shell environment in vscode.'
    );
    return Promise.resolve(false);
  }

  if (!shellCommand) {
    void vscode.window.showErrorMessage(
      'No MongoDB shell command found. Please set the shell command in the MongoDB extension settings.'
    );
    return Promise.resolve(false);
  }

  const mdbConnectionString = connectionController.getActiveConnectionString();
  const parentHandle =
    connectionController.getMongoClientConnectionOptions()?.options
      .parentHandle;

  let envVariableString = '';

  if (userShell.includes('powershell.exe')) {
    envVariableString = getPowershellEnvString();
  } else if (userShell.includes('cmd.exe')) {
    envVariableString = getCmdEnvString();
  } else if (userShell.toLocaleLowerCase().includes('git\\bin\\bash.exe')) {
    envVariableString = getGitBashEnvString();
  } else {
    // Assume it's a bash environment. This may fail on certain
    // shells but should cover most cases.
    envVariableString = getBashEnvString();
  }

  launchMongoDBShellWithEnv({
    shellCommand,
    mdbConnectionString,
    parentHandle,
    envVariableString,
  });

  return Promise.resolve(true);
};

export default openMongoDBShell;
