import * as vscode from 'vscode';

import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import { LanguageServerController } from '../language';
import TelemetryController, {
  TelemetryEventTypes,
  TelemetryEventProperties
} from '../telemetry/telemetryController';
import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import { OutputChannel, ProgressLocation, TextEditor } from 'vscode';
import playgroundTemplate from '../templates/playgroundTemplate';
import { createLogger } from '../logging';

const log = createLogger('playground controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _languageServerController: LanguageServerController;
  _telemetryController?: TelemetryController;
  _activeConnectionCodeLensProvider?: ActiveConnectionCodeLensProvider;
  _outputChannel: OutputChannel;
  _connectionString?: string;
  _connectionOptions?: any;
  _activeTextEditor?: TextEditor;

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
    this._activeConnectionCodeLensProvider = new ActiveConnectionCodeLensProvider(
      this._connectionController
    );
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this._activeConnectionCodeLensProvider
      )
    );

    this._connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      async () => {
        await this.disconnectFromServiceProvider();
      }
    );

    this._connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      async () => {
        await this.connectToServiceProvider();

        if (this._activeConnectionCodeLensProvider) {
          this._activeConnectionCodeLensProvider.refresh();
        }
      }
    );

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (
        editor &&
        editor.document &&
        !editor.document.uri.path.includes('extension-output')
      ) {
        this._activeTextEditor = editor;
        log.info('Active editor uri', editor.document.uri.path);
      }
    });
  }

  public disconnectFromServiceProvider(): Promise<boolean> {
    return this._languageServerController.disconnectFromServiceProvider();
  }

  public connectToServiceProvider(): Promise<boolean> {
    const model = this._connectionController
      .getActiveConnectionModel()
      ?.getAttributes({ derived: true });

    if (model && model.driverUrl) {
      this._connectionString = model.driverUrl;
      this._connectionOptions = model.driverOptions ? model.driverOptions : {};

      return this._languageServerController.connectToServiceProvider({
        connectionString: this._connectionString,
        connectionOptions: this._connectionOptions,
        extensionPath: this._context.extensionPath
      });
    }

    this._connectionString = undefined;
    this._connectionOptions = undefined;

    return this._languageServerController.disconnectFromServiceProvider();
  }

  public createPlayground(): Promise<boolean> {
    const useDefaultTemplate = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useDefaultTemplateForPlayground');

    return new Promise((resolve, reject) => {
      vscode.workspace
        .openTextDocument({
          language: 'mongodb',
          content: useDefaultTemplate ? playgroundTemplate : ''
        })
        .then((document) => {
          this._outputChannel.show(true);
          vscode.window.showTextDocument(document);
          resolve(true);
        }, reject);
    });
  }

  public showActiveConnectionInPlayground(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this._outputChannel.clear();
      this._outputChannel.append(message);
      this._outputChannel.show(true);

      resolve(true);
    });
  }

  public prepareTelemetry(res: any): TelemetryEventProperties {
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

  private async evaluate(codeToEvaluate: string): Promise<any> {
    if (!this._connectionString) {
      return Promise.reject(
        new Error('Please connect to a database before running a playground.')
      );
    }

    // Send a request to the language server to execute scripts from a playground
    const result = await this._languageServerController.executeAll(
      codeToEvaluate
    );

    if (result) {
      // Send metrics to Segment
      this._telemetryController?.track(
        TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED,
        this.prepareTelemetry(result)
      );
    }

    return Promise.resolve(result);
  }

  private evaluateWithCancelModal(): Promise<any> {
    return new Promise((resolve) => {
      vscode.window
        .withProgress(
          {
            location: ProgressLocation.Notification,
            title: 'Running MongoDB playground...',
            cancellable: true
          },
          async (progress, token) => {
            token.onCancellationRequested(async () => {
              // If a user clicked the cancel button terminate all playground scripts
              this._languageServerController.cancelAll();
              this._outputChannel.clear();
              this._outputChannel.show(true);

              return resolve(null);
            });

            const codeToEvaluate =
              this._activeTextEditor?.document.getText() || '';
            // Run all playground scripts
            const result = await this.evaluate(codeToEvaluate);

            return resolve(result);
          }
        )
        .then(undefined, (error) => {
          log.error('Evaluate playground with cancel modal error', error);

          return resolve(null);
        });
    });
  }

  public runAllPlaygroundBlocks(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const shouldConfirmRunAll = vscode.workspace
        .getConfiguration('mdb')
        .get('confirmRunAll');

      if (!this._connectionString) {
        vscode.window.showErrorMessage(
          'Please connect to a database before running a playground.'
        );

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

      const result = await this.evaluateWithCancelModal();

      if (!result) {
        this._outputChannel.clear();
        this._outputChannel.show(true);

        return resolve(false);
      }

      this._outputChannel.clear();
      this._outputChannel.append(result);
      this._outputChannel.show(true);

      return resolve(true);
    });
  }

  public deactivate(): void {
    this._connectionController.removeEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        // No action is required after removing the listener.
      }
    );
  }
}
