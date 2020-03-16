import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import { ElectronRuntime } from 'mongosh/packages/browser-runtime-electron';
import { CompassServiceProvider } from 'mongosh/packages/service-provider-server';
import ActiveDBCodeLensProvider from './activeDBCodeLensProvider';
import formatOutput from '../utils/formatOutput';
import { createLogger } from '../logging';

const log = createLogger('editors controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _context?: vscode.ExtensionContext;
  _connectionController?: ConnectionController;
  _runtime?: ElectronRuntime;
  _activeDB?: any;
  _activeDBCodeLensProvider?: ActiveDBCodeLensProvider;

  constructor(context: vscode.ExtensionContext, connectionController: ConnectionController) {
    this._context = context;
    this._connectionController = connectionController;
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

    const activeConnection = this._connectionController.getActiveDataService();

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
    const activeDB = await this._runtime.evaluate('db');

    if (!this._activeDBCodeLensProvider) {
      this._activeDBCodeLensProvider = new ActiveDBCodeLensProvider(this._connectionController);
      this._context?.subscriptions.push(vscode.languages.registerCodeLensProvider(
        {
          language: 'mongodb'
        },
        this._activeDBCodeLensProvider
      ));
    }

    this._activeDBCodeLensProvider.setActiveDB(activeDB.value);

    return Promise.resolve(value);
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const activeEditor = vscode.window.activeTextEditor;
      const codeToEvaluate = activeEditor?.document.getText() || '';
      const outputChannel = vscode.window.createOutputChannel(
        'Playground output'
      );
      let result;

      try {
        result = await this.evaluate(codeToEvaluate);
      } catch (error) {
        vscode.window.showErrorMessage(`Unable to run playground: ${error.message}`);
        return resolve(false);
      }

      outputChannel.appendLine(result);
      outputChannel.show(true);

      resolve(true);
    });
  }
}
