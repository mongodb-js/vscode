import * as vscode from 'vscode';

import ConnectionController, { DataServiceEventTypes } from '../connectionController';
import { LanguageServerController } from '../language';
import TelemetryController, { TelemetryEventTypes } from '../telemetry/telemetryController';
import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import formatOutput from '../utils/formatOutput';
import { OutputChannel, ProgressLocation } from 'vscode';
import playgroundTemplate from '../templates/playgroundTemplate';

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _languageServerController: LanguageServerController;
  _telemetryController?: TelemetryController;
  _activeDB?: any;
  _activeConnectionCodeLensProvider?: ActiveConnectionCodeLensProvider;
  _outputChannel: OutputChannel;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    languageServerController: LanguageServerController,
    telemetryController?: TelemetryController
  ) {
    this._context = context;
    this._connectionController = connectionController;
    this._languageServerController = languageServerController;
    this._telemetryController = telemetryController;
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

  prepareTelemetry(res: any) {
    let type = 'other';

    if (!res.shellApiType) {
      return { type };
    }

    const shellApiType = res.shellApiType.toLocaleLowerCase();

    // See: https://github.com/mongodb-js/mongosh/blob/master/packages/shell-api/src/shell-api.js
    if (shellApiType.includes('insert')) {
      type = 'insert';
    } else if (shellApiType.includes('update')) {
      type = 'update';
    } else if (shellApiType.includes('delete')) {
      type = 'delete';
    } else if (shellApiType.includes('aggregation')) {
      type = 'aggregation';
    } else if (shellApiType.includes('cursor')) {
      type = 'query';
    }

    return { type };
  }

  async evaluate(codeToEvaluate: string): Promise<any> {
    const activeConnectionString = this._connectionController.getActiveConnectionDriverUrl();

    if (!activeConnectionString) {
      return Promise.reject(
        new Error('Please connect to a database before running a playground.')
      );
    }

    // Run playground as a background process using the Language Server
    let res = await this._languageServerController.executeAll(codeToEvaluate, activeConnectionString);

    if (res) {
      this._telemetryController?.track(
        TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED,
        this.prepareTelemetry(res)
      );

      res = formatOutput(res)
    }

    return Promise.resolve(res);
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const activeConnection = this._connectionController.getActiveDataService();
      const shouldConfirmRunAll = vscode.workspace
        .getConfiguration('mdb')
        .get('confirmRunAll');

      if (activeConnection && shouldConfirmRunAll === true) {
        const name = this._connectionController.getActiveConnectionName();
        const confirmRunAll = await vscode.window.showInformationMessage(
          `Are you sure you want to run this playground against ${name}? This confirmation can be disabled in the extension settings.`,
          { modal: true },
          'Yes'
        );

        if (confirmRunAll !== 'Yes') {
          return Promise.resolve(false);
        }
      }

      const activeEditor = vscode.window.activeTextEditor;
      const codeToEvaluate = activeEditor?.document.getText() || '';
      let result;

      // Show a running progress in the notification area with support for cancellation
      vscode.window.withProgress({
        location: ProgressLocation.Notification,
        title: 'Running a playground...',
        cancellable: true
      }, async (progress, token) => {
        token.onCancellationRequested(async () => {
          // Cancel running a playground when clicked on the cancel button
          this._languageServerController.cancelAll();
          vscode.window.showInformationMessage('User canceled the long running operation');
          return resolve(false);
        });

        try {
          result = await this.evaluate(codeToEvaluate);
        } catch (error) {
          vscode.window.showErrorMessage(`Unable to run playground: ${error.message}`);
          return resolve(false);
        }

        this._outputChannel.clear();
        this._outputChannel.appendLine(result);
        this._outputChannel.show(true);

        return resolve(true);
      });
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
