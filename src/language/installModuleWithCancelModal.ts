import * as vscode from 'vscode';
import * as os from 'os';
import spawn from 'cross-spawn';
import { ProgressLocation } from 'vscode';

import formatError from '../utils/formatError';

/**
 * Check if Yarn is installed on users computer.
 */
const isYarnInstalled = (): boolean => {
  try {
    spawn.sync('yarnpkg', ['--version'], {
      cwd: os.homedir(),
      encoding: 'utf8',
      stdio: 'ignore',
    });

    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Install an npm module with a cancelation modal.
 */
export const installModuleWithCancelModal = async (
  moduleName: string
): Promise<boolean> => {
  try {
    const progressResult = await vscode.window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Running MongoDB playground...',
        cancellable: true,
      },
      (progress, token) => {
        token.onCancellationRequested(() => {
          return Promise.resolve(false);
        });

        // Choose which package manger to use.
        const packageManager = isYarnInstalled() ? 'yarn' : 'npm';
        spawn.sync(packageManager, ['install', moduleName, '--no-save'], {
          cwd: os.homedir(),
          encoding: 'utf8',
          stdio: 'inherit',
        });

        return Promise.resolve(true);
      }
    );

    return progressResult;
  } catch (error) {
    const printableError = formatError(error);
    void vscode.window.showErrorMessage(printableError.message);
    return Promise.resolve(false);
  }
};
