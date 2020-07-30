import * as vscode from 'vscode';
import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import { LanguageServerController } from '../language';
import TelemetryController from '../telemetry/telemetryController';
import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import PartialExecutionCodeLensProvider from './partialExecutionCodeLensProvider';
import { OutputChannel, ProgressLocation, TextEditor } from 'vscode';
import playgroundTemplate from '../templates/playgroundTemplate';
import playgroundSearchTemplate from '../templates/playgroundSearchTemplate';
import { createLogger } from '../logging';

const log = createLogger('playground controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  public _connectionController: ConnectionController;
  public _activeTextEditor?: TextEditor;
  public _partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider;
  private _context: vscode.ExtensionContext;
  private _languageServerController: LanguageServerController;
  private _telemetryController: TelemetryController;
  private _activeConnectionCodeLensProvider?: ActiveConnectionCodeLensProvider;
  private _outputChannel: OutputChannel;
  private _connectionString?: string;
  private _connectionOptions?: any;
  private _selectedText?: string;
  private _codeToEvaluate: string;
  private _isPartialRun: boolean;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    languageServerController: LanguageServerController,
    telemetryController: TelemetryController
  ) {
    this._context = context;
    this._codeToEvaluate = '';
    this._isPartialRun = false;
    this._connectionController = connectionController;
    this._languageServerController = languageServerController;
    this._telemetryController = telemetryController;
    this._outputChannel = vscode.window.createOutputChannel(
      'Playground output'
    );
    this._activeConnectionCodeLensProvider = new ActiveConnectionCodeLensProvider(
      this._connectionController
    );
    this._partialExecutionCodeLensProvider = new PartialExecutionCodeLensProvider();
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this._activeConnectionCodeLensProvider
      )
    );
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this._partialExecutionCodeLensProvider
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
        this._activeConnectionCodeLensProvider?.refresh();
      }
    );

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (
        editor &&
        editor.document &&
        editor.document.languageId === 'mongodb'
      ) {
        this._activeTextEditor = editor;
        log.info('Active editor path', editor.document.uri?.path);
      }
    });

    vscode.window.onDidChangeTextEditorSelection((editor) => {
      if (
        editor &&
        editor.textEditor &&
        editor.textEditor.document &&
        editor.textEditor.document.languageId === 'mongodb'
      ) {
        this._selectedText = (editor.selections as Array<any>)
          .sort((a, b) => (a.start.line > b.start.line ? 1 : -1)) // Sort lines selected as alt+click
          .map((item, index) => {
            if (index === editor.selections.length - 1) {
              this.showCodeLensForSelection(item);
            }

            return this.getSelectedText(item);
          })
          .join('\n');
      }
    });
  }

  public showCodeLensForSelection(item: vscode.Range): void {
    const selectedText = this.getSelectedText(item).trim();
    const lastSelectedLine =
      this._activeTextEditor?.document.lineAt(item.end.line).text.trim() || '';

    if (
      selectedText.length > 0 &&
      selectedText.length >= lastSelectedLine.length
    ) {
      this._partialExecutionCodeLensProvider?.refresh(
        new vscode.Range(item.end.line + 1, 0, item.end.line + 1, 0)
      );
    } else {
      this._partialExecutionCodeLensProvider?.refresh();
    }
  }

  public disconnectFromServiceProvider(): Promise<boolean> {
    return this._languageServerController.disconnectFromServiceProvider();
  }

  public connectToServiceProvider(): Promise<boolean> {
    const model = this._connectionController
      .getActiveConnectionModel()
      ?.getAttributes({ derived: true });

    if (model && model.driverUrlWithSsh) {
      this._connectionString = model.driverUrlWithSsh;
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

  public createPlaygroundForSearch(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const content = playgroundSearchTemplate
        .replace('CURRENT_DATABASE', databaseName)
        .replace('CURRENT_COLLECTION', collectionName);

      vscode.workspace
        .openTextDocument({
          language: 'mongodb',
          content
        })
        .then((document) => {
          this._outputChannel.show(true);
          vscode.window.showTextDocument(document);
          resolve(true);
        }, reject);
    });
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

  public async evaluate(codeToEvaluate: string): Promise<any> {
    // Send a request to the language server to execute scripts from a playground.
    const result = await this._languageServerController.executeAll(
      codeToEvaluate
    );

    // Send metrics to Segment.
    this._telemetryController.trackPlaygroundCodeExecuted(
      result,
      this._isPartialRun,
      result ? false : true
    );

    return Promise.resolve(result);
  }

  private getAllText(): string {
    return this._activeTextEditor?.document.getText() || '';
  }

  private getSelectedText(selection: any): string {
    return this._activeTextEditor?.document.getText(selection) || '';
  }

  public evaluateWithCancelModal(): Promise<any> {
    if (!this._connectionString) {
      return Promise.reject(
        new Error('Please connect to a database before running a playground.')
      );
    }

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
              // If a user clicked the cancel button terminate all playground scripts.
              this._languageServerController.cancelAll();
              this._outputChannel.clear();
              this._outputChannel.show(true);

              return resolve(null);
            });

            // Run all playground scripts.
            const result = await this.evaluate(this._codeToEvaluate);

            return resolve(result);
          }
        )
        .then(undefined, (error) => {
          log.error('Evaluate playground with cancel modal error', error);

          return resolve(null);
        });
    });
  }

  public evaluatePlayground(): Promise<boolean> {
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

  public runSelectedPlaygroundBlocks() {
    if (this._activeTextEditor && this._activeTextEditor.document) {
      const selections = this._activeTextEditor.selections;

      if (
        !selections ||
        !Array.isArray(selections) ||
        (selections.length === 1 && this.getSelectedText(selections[0]) === '')
      ) {
        vscode.window.showInformationMessage(
          'Please select one or more lines in the playground.'
        );

        return Promise.resolve(true);
      } else if (this._selectedText) {
        this._isPartialRun = true;
        this._codeToEvaluate = this._selectedText;
      }
    }

    return this.evaluatePlayground();
  }

  public runAllPlaygroundBlocks() {
    if (this._activeTextEditor) {
      this._isPartialRun = false;
      this._codeToEvaluate = this.getAllText();
    }

    return this.evaluatePlayground();
  }

  public runAllOrSelectedPlaygroundBlocks() {
    if (this._activeTextEditor && this._activeTextEditor.document) {
      const selections = this._activeTextEditor.selections;

      if (
        !selections ||
        !Array.isArray(selections) ||
        (selections.length === 1 && this.getSelectedText(selections[0]) === '')
      ) {
        this._isPartialRun = false;
        this._codeToEvaluate = this.getAllText();
      } else if (this._selectedText) {
        this._isPartialRun = true;
        this._codeToEvaluate = this._selectedText;
      }
    }

    return this.evaluatePlayground();
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
