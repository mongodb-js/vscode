import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import { ElectronRuntime } from 'mongosh/packages/browser-runtime-electron';
import { CompassServiceProvider } from 'mongosh/packages/service-provider-server';
import formatOutput from '../utils/formatOutput';
import { createLogger } from '../logging';

const log = createLogger('editors controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _connectionController?: ConnectionController;
  _runtime?: ElectronRuntime;

  activate(connectionController: ConnectionController): void {
    log.info('activate playground controller');

    this._connectionController = connectionController;

    const activeConnection = this._connectionController.getActiveConnection();

    if (activeConnection) {
      const serviceProvider = CompassServiceProvider.fromDataService(
        activeConnection
      );

      this._runtime = new ElectronRuntime(serviceProvider);
    }
  }

  deactivate(): void {
    if (this._runtime) {
      delete this._runtime;
    }
  }

  createPlayground(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      vscode.workspace
        .openTextDocument({
          language: 'mongodb',
          content: '// The MongoDB playground'
        })
        .then((document) => {
          vscode.window.showTextDocument(document);
          resolve(true);
        }, reject);
    });
  }

  async evaluate(codeToEvaluate: string): Promise<any> {
    if (!this._connectionController) {
      return Promise.reject(new Error('No connection controller.'));
    }

    const activeConnection = this._connectionController.getActiveConnection();

    if (!activeConnection) {
      return Promise.reject(
        new Error('Please connect to a database before running a playground.')
      );
    }

    const serviceProvider = CompassServiceProvider.fromDataService(
      activeConnection
    );

    if (!this._runtime) {
      this._runtime = new ElectronRuntime(serviceProvider);
    }

    const res = await this._runtime.evaluate(codeToEvaluate);
    const value = formatOutput(res);

    return value;
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const activeEditor = vscode.window.activeTextEditor;
      const codeToEvaluate = activeEditor?.document.getText() || '';
      const outputChannel = vscode.window.createOutputChannel(
        'Playground output'
      );
      const res = await this.evaluate(codeToEvaluate);

      outputChannel.appendLine(res);
      outputChannel.show(true);

      resolve(true);
    });
  }
}
