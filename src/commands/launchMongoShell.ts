import * as vscode from 'vscode';

import type ConnectionController from '../connectionController';
import { confirmConnection } from '../utils/confirmConnection';

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
  return '"$Env:MDB_CONNECTION_STRING"';
};

const getCmdEnvString = (): string => {
  // Quoting wraps the *substituted* value (cmd.exe expands %VAR% before
  // parsing for shell metacharacters like |, &, >), so this prevents a
  // connection string from injecting extra commands.
  return '"%MDB_CONNECTION_STRING%"';
};

const getGitBashEnvString = (): string => {
  return '"$MDB_CONNECTION_STRING"';
};

const getBashEnvString = (): string => {
  return '"$MDB_CONNECTION_STRING"';
};

const openMongoDBShell = async (
  connectionController: ConnectionController,
): Promise<boolean> => {
  if (!connectionController.isCurrentlyConnected()) {
    void vscode.window.showErrorMessage(
      'You need to be connected before launching the MongoDB Shell.',
    );
    return Promise.resolve(false);
  }

  const userShell = vscode.env.shell;
  const shellCommand: string | undefined = vscode.workspace
    .getConfiguration('mdb')
    .get('shell');

  if (!userShell) {
    void vscode.window.showErrorMessage(
      'No shell found, please set your default shell environment in vscode.',
    );
    return Promise.resolve(false);
  }

  if (!shellCommand) {
    void vscode.window.showErrorMessage(
      'No MongoDB shell command found. Please set the shell command in the MongoDB extension settings.',
    );
    return Promise.resolve(false);
  }

  if (shellCommand !== 'mongo' && shellCommand !== 'mongosh') {
    void vscode.window.showErrorMessage(
      'Invalid MongoDB shell command specified. Please set the shell command to "mongo" or "mongosh" in the MongoDB extension settings.',
    );
    return Promise.resolve(false);
  }

  const mdbConnectionString = connectionController.getActiveConnectionString();

  if (/["\r\n]/.test(mdbConnectionString)) {
    void vscode.window.showErrorMessage(
      'The connection string contains unsupported characters (quotes or line breaks) and cannot be used to launch the MongoDB Shell.',
    );
    return Promise.resolve(false);
  }

  const parentHandle =
    connectionController.getMongoClientConnectionOptions()?.options
      .parentHandle;

  let envVariableString: string;

  // Shell paths are case-insensitive on Windows, so normalize before matching.
  const normalizedUserShell = userShell.toLowerCase();

  if (
    normalizedUserShell.includes('powershell.exe') ||
    normalizedUserShell.includes('pwsh')
  ) {
    envVariableString = getPowershellEnvString();
  } else if (normalizedUserShell.includes('cmd.exe')) {
    envVariableString = getCmdEnvString();
  } else if (normalizedUserShell.includes('git\\bin\\bash.exe')) {
    envVariableString = getGitBashEnvString();
  } else {
    // Assume it's a bash environment. This may fail on certain
    // shells but should cover most cases.
    envVariableString = getBashEnvString();
  }

  // The shell is handed the connection string of whichever connection is active, which
  // may have been set up a while ago or by someone else, so confirm the destination.
  const confirmed = await confirmConnection({
    connectionString: mdbConnectionString,
    question:
      'Please verify the details below. Would you like to launch the MongoDB Shell with this connection?',
    action: 'Launch Shell',
  });

  if (!confirmed) {
    return false;
  }

  launchMongoDBShellWithEnv({
    shellCommand,
    mdbConnectionString,
    parentHandle,
    envVariableString,
  });

  return true;
};

export default openMongoDBShell;
