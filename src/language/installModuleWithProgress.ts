import * as vscode from 'vscode';
import * as os from 'os';
import { ProgressLocation } from 'vscode';
import { execSync, spawn } from 'child_process';

import { createLogger } from '../logging';
const log = createLogger('install npm module');

/**
 * Check if Yarn is installed on users computer.
 */
const isYarnInstalled = (): boolean => {
  try {
    execSync('yarnpkg --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    log.info('The yarn package was not found');
    return false;
  }
};

/**
 * Install an npm module with a progress bar.
 */
export const installModuleWithProgress = async (
  moduleName: string
): Promise<{ ok?: 1; canceled?: 1 }> => {
  moduleName = moduleName === 'node-fetch' ? 'node-fetch@2' : moduleName;
  return await vscode.window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'Running MongoDB playground...',
      cancellable: true,
    },
    (progress, token) => {
      return new Promise((resolve, reject) => {
        // Choose which package manger to use.
        const packageManager = isYarnInstalled() ? 'yarn' : 'npm';

        const child = spawn(
          packageManager,
          ['install', moduleName, '--no-save'],
          {
            cwd: os.homedir(),
            stdio: 'pipe',
          }
        );
        let stderr = '';

        child.stderr?.setEncoding('utf8').on('data', (chunk) => {
          stderr += chunk;
        });

        child.on('close', (code) => {
          if (code !== 0) {
            log.error(
              `Install npm module child process exited with code ${code}`,
              stderr
            );
            return reject(
              new Error(
                `Failed to install the ${moduleName} module with error: ${stderr}`
              )
            );
          }

          log.info(`The '${moduleName}' module was installed`);
          return resolve({ ok: 1 });
        });

        token.onCancellationRequested(() => {
          child.kill();
          log.info('The npm module install was canceled');
          return resolve({ canceled: 1 });
        });
      });
    }
  );
};
