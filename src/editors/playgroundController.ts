import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CompassServiceProvider } from '@mongosh/service-provider-server';
import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import formatOutput from '../utils/formatOutput';
import { createLogger } from '../logging';
import { OutputChannel } from 'vscode';
import { DataServiceEventTypes } from '../connectionController';
import playgroundTemplate from '../templates/playgroundTemplate';

const log = createLogger('editors controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _activeDB?: any;
  _activeConnectionCodeLensProvider?: ActiveConnectionCodeLensProvider;
  _outputChannel: OutputChannel;

  constructor(context: vscode.ExtensionContext, connectionController: ConnectionController) {
    this._context = context;
    this._connectionController = connectionController;
    this._outputChannel = vscode.window.createOutputChannel(
      'Playground output'
    );
    this._activeConnectionCodeLensProvider = new ActiveConnectionCodeLensProvider(this._connectionController);
    this._context.subscriptions.push(vscode.languages.registerCodeLensProvider(
      {
        language: 'mongodb'
      },
      this._activeConnectionCodeLensProvider
    ));

    this._connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        if (this._activeConnectionCodeLensProvider) {
          this._activeConnectionCodeLensProvider.refresh();
        }
      }
    );
  }

  createPlayground(): Promise<boolean> {
    const useDefaultTemplate: boolean = !!vscode.workspace.getConfiguration('mdb').get('useDefaultTemplateForPlayground');

    return new Promise((resolve, reject) => {
      vscode.workspace
        .openTextDocument({
          language: 'mongodb',
          content: useDefaultTemplate ? playgroundTemplate : ''
        })
        .then((document) => {
          vscode.window.showTextDocument(document);
          resolve(true);
        }, reject);
    });
  }

  showActiveConnectionInPlayground(message: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      this._outputChannel.clear();
      this._outputChannel.appendLine(message);
      this._outputChannel.show(true);

      resolve(true);
    });
  }

  async evaluate(codeToEvaluate: string): Promise<any> {
    const activeConnection = this._connectionController.getActiveDataService();

    if (!activeConnection) {
      return Promise.reject(
        new Error('Please connect to a database before running a playground.')
      );
    }

    const serviceProvider = CompassServiceProvider.fromDataService(
      activeConnection
    );
    const runtime = new ElectronRuntime(serviceProvider);
    const res = await runtime.evaluate(codeToEvaluate);
    const value = formatOutput(res);

    return Promise.resolve(value);
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const activeEditor = vscode.window.activeTextEditor;
      const codeToEvaluate = activeEditor?.document.getText() || '';
      let result;

      try {
        result = await this.evaluate(codeToEvaluate);
      } catch (error) {
        vscode.window.showErrorMessage(`Unable to run playground: ${error.message}`);
        return resolve(false);
      }

      this._outputChannel.clear();
      this._outputChannel.appendLine(result);
      this._outputChannel.show(true);

      resolve(true);
    });
  }

  public deactivate(): void {
    this._connectionController.removeEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        /**
         * No action is required after removing the listener.
         */
      }
    );
  }
}
