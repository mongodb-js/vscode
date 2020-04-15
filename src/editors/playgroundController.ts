import * as vscode from 'vscode';

import ConnectionController, { DataServiceEventTypes } from '../connectionController';
import { LanguageServerController } from '../language';
import TelemetryController, { TelemetryEventTypes } from '../telemetry/telemetryController';
import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
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
          this._outputChannel.show(true);
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

    // Send a request to the language server to execute scripts from a playground
    const result = await this._languageServerController.executeAll(codeToEvaluate, activeConnectionString);

    if (result) {
      // Send metrics to Segment
      this._telemetryController?.track(
        TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED,
        this.prepareTelemetry(result)
      );
    }

    return Promise.resolve(result);
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const activeConnection = this._connectionController.getActiveDataService();
      const shouldConfirmRunAll = vscode.workspace
        .getConfiguration('mdb')
        .get('confirmRunAll');

      if (!activeConnection) {
        vscode.window.showErrorMessage('Please connect to a database before running a playground.');

        return resolve(false);
      }

      if (shouldConfirmRunAll === true) {
        const name = this._connectionController.getActiveConnectionName();
        const confirmRunAll = await vscode.window.showInformationMessage(
          `Are you sure you want to run this playground against ${name}? This confirmation can be disabled in the extension settings.`,
          { modal: true },
          'Yes'
        );

        if (confirmRunAll !== 'Yes') {
          return resolve(false);
        }
      }

      const activeEditor = vscode.window.activeTextEditor;
      const codeToEvaluate = activeEditor?.document.getText() || '';
      let result;

      // Show a running progress in the notification area with support for cancellation
      await vscode.window.withProgress({
        location: ProgressLocation.Notification,
        title: 'Running MongoDB playground...',
        cancellable: true
      }, async (progress, token) => {
        token.onCancellationRequested(() => {
          // If a user clicked the cancel button terminate all playground scripts
          this._languageServerController.cancelAll();
          this._outputChannel.clear();
          this._outputChannel.show(true);

          return resolve(false);
        });

        // Run all playground scripts
        result = await this.evaluate(codeToEvaluate);
      });

      if (!result) {
        this._outputChannel.clear();
        this._outputChannel.show(true);

        return resolve(false);
      }

      this._outputChannel.clear();
      this._outputChannel.appendLine(result);
      this._outputChannel.show(true);

      return resolve(true);
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
