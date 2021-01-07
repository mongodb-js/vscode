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
import playgroundCreateIndexTemplate from '../templates/playgroundCreateIndexTemplate';
import { createLogger } from '../logging';
import type { ExecuteAllResult } from '../utils/types';
import PlaygroundResultProvider, {
  PLAYGROUND_RESULT_SCHEME
} from './playgroundResultProvider';
import type { OutputItem } from '../utils/types';
import { StatusView } from '../views';

const log = createLogger('playground controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  connectionController: ConnectionController;
  activeTextEditor?: TextEditor;
  partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider;
  playgroundResult?: OutputItem;
  _context: vscode.ExtensionContext;
  _languageServerController: LanguageServerController;
  _telemetryController: TelemetryController;
  _activeConnectionCodeLensProvider?: ActiveConnectionCodeLensProvider;
  _outputChannel: OutputChannel;
  _connectionString?: string;
  _connectionOptions?: any;
  _selectedText?: string;
  _codeToEvaluate: string;
  _isPartialRun: boolean;
  _playgroundResultViewColumn?: vscode.ViewColumn;
  _playgroundResultTextDocument?: vscode.TextDocument;
  _statusView: StatusView;
  _playgroundResultViewProvider: PlaygroundResultProvider;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    languageServerController: LanguageServerController,
    telemetryController: TelemetryController,
    statusView: StatusView
  ) {
    this._context = context;
    this._codeToEvaluate = '';
    this._isPartialRun = false;
    this.connectionController = connectionController;
    this._languageServerController = languageServerController;
    this._telemetryController = telemetryController;
    this._statusView = statusView;
    this._outputChannel = vscode.window.createOutputChannel(
      'Playground output'
    );
    this._activeConnectionCodeLensProvider = new ActiveConnectionCodeLensProvider(
      this.connectionController
    );
    this.partialExecutionCodeLensProvider = new PartialExecutionCodeLensProvider();
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this._activeConnectionCodeLensProvider
      )
    );
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this.partialExecutionCodeLensProvider
      )
    );

    this.connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      async () => {
        await this.disconnectFromServiceProvider();
      }
    );

    this.connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      async () => {
        await this.connectToServiceProvider();
        this._activeConnectionCodeLensProvider?.refresh();
      }
    );

    const onEditorChange = (editor: vscode.TextEditor | undefined) => {
      if (editor?.document.uri.scheme === PLAYGROUND_RESULT_SCHEME) {
        this._playgroundResultViewColumn = editor.viewColumn;
        this._playgroundResultTextDocument = editor?.document;
      }

      if (editor?.document.languageId !== 'Log') {
        this.activeTextEditor = editor;
        log.info('Active editor path', editor?.document.uri?.path);
      }
    };

    vscode.window.onDidChangeActiveTextEditor(onEditorChange);
    onEditorChange(vscode.window.activeTextEditor);

    vscode.window.onDidChangeTextEditorSelection(
      (editor: vscode.TextEditorSelectionChangeEvent) => {
        if (
          editor &&
          editor.textEditor &&
          editor.textEditor.document &&
          editor.textEditor.document.languageId === 'mongodb'
        ) {
          this._selectedText = (editor.selections as Array<vscode.Selection>)
            .sort((a, b) => (a.start.line > b.start.line ? 1 : -1)) // Sort lines selected as alt+click.
            .map((item, index) => {
              if (index === editor.selections.length - 1) {
                this.showCodeLensForSelection(item);
              }

              return this.getSelectedText(item);
            })
            .join('\n');
        }
      }
    );

    const playgroundResultViewProvider = new PlaygroundResultProvider(context);

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        PLAYGROUND_RESULT_SCHEME,
        playgroundResultViewProvider
      )
    );

    this._playgroundResultViewProvider = playgroundResultViewProvider;
  }

  showCodeLensForSelection(item: vscode.Range): void {
    const selectedText = this.getSelectedText(item).trim();
    const lastSelectedLine =
      this.activeTextEditor?.document.lineAt(item.end.line).text.trim() || '';
    const selections = this.activeTextEditor?.selections.sort((a, b) =>
      a.start.line > b.start.line ? 1 : -1
    );
    const firstLine = selections ? selections[0].start.line : 0;

    if (
      selectedText.length > 0 &&
      selectedText.length >= lastSelectedLine.length
    ) {
      this.partialExecutionCodeLensProvider?.refresh(
        new vscode.Range(firstLine, 0, firstLine, 0)
      );
    } else {
      this.partialExecutionCodeLensProvider?.refresh();
    }
  }

  disconnectFromServiceProvider(): Promise<boolean> {
    return this._languageServerController.disconnectFromServiceProvider();
  }

  connectToServiceProvider(): Promise<boolean> {
    const model = this.connectionController
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

  createPlaygroundFileWithContent(
    content: string | undefined
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
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

  createPlaygroundForSearch(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    const content = playgroundSearchTemplate
      .replace('CURRENT_DATABASE', databaseName)
      .replace('CURRENT_COLLECTION', collectionName);

    return this.createPlaygroundFileWithContent(content);
  }

  createPlaygroundForNewIndex(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    const content = playgroundCreateIndexTemplate
      .replace('CURRENT_DATABASE', databaseName)
      .replace('CURRENT_COLLECTION', collectionName);

    return this.createPlaygroundFileWithContent(content);
  }

  createPlayground(): Promise<boolean> {
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

  async evaluate(codeToEvaluate: string): Promise<ExecuteAllResult> {
    this._statusView.showMessage('Getting results...');

    // Send a request to the language server to execute scripts from a playground.
    const result: ExecuteAllResult = await this._languageServerController.executeAll(
      codeToEvaluate
    );

    this._statusView.hideMessage();

    // Send metrics to Segment.
    this._telemetryController.trackPlaygroundCodeExecuted(
      result,
      this._isPartialRun,
      result ? false : true
    );

    return result;
  }

  getAllText(): string {
    return this.activeTextEditor?.document.getText() || '';
  }

  getSelectedText(selection: vscode.Range): string {
    return this.activeTextEditor?.document.getText(selection) || '';
  }

  evaluateWithCancelModal(): Promise<ExecuteAllResult> {
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
            token.onCancellationRequested(() => {
              // If a user clicked the cancel button terminate all playground scripts.
              this._languageServerController.cancelAll();
              this._outputChannel.clear();
              this._outputChannel.show(true);

              return resolve({
                outputLines: undefined,
                result: undefined
              });
            });

            // Run all playground scripts.
            const result: ExecuteAllResult = await this.evaluate(
              this._codeToEvaluate
            );

            return resolve(result);
          }
        )
        .then(undefined, (error) => {
          log.error('Evaluate playground with cancel modal error', error);

          return resolve({
            outputLines: undefined,
            result: undefined
          });
        });
    });
  }

  getVirtualDocumentUri(content?: any): vscode.Uri {
    let extension = '';

    if (typeof content === 'object') {
      extension = 'json';
    } else {
      extension = 'txt';
    }

    return vscode.Uri.parse(
      [
        `${PLAYGROUND_RESULT_SCHEME}:Playground Result`,
        `.${extension}`,
        `?id=${Date.now()}`
      ].join('')
    );
  }

  async openPlaygroundResult(): Promise<void> {
    let viewColumn: vscode.ViewColumn =
      this._playgroundResultViewColumn || vscode.ViewColumn.Beside;

    if (this._playgroundResultTextDocument) {
      await this._playgroundResultViewProvider.reopenResultAsVirtualDocument(
        viewColumn,
        this.playgroundResult
      );
    } else {
      await this.openResultAsVirtualDocument(viewColumn);
    }
  }

  async openResultAsVirtualDocument(
    viewColumn: vscode.ViewColumn
  ): Promise<void> {
    const content =
      this.playgroundResult && this.playgroundResult.content
        ? this.playgroundResult.content
        : '';

    this._playgroundResultViewProvider.refreshPlaygroundResult(
      this.playgroundResult
    );

    const uri = this.getVirtualDocumentUri(content);

    this._playgroundResultViewProvider.setPlaygroundResultUri(uri);

    await vscode.workspace.openTextDocument(uri).then(
      (doc) => {
        this._playgroundResultTextDocument = doc;

        return vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn
        });
      },
      (error) => {
        log.error('Open result as VirtualDocument ERROR', error);

        return vscode.window.showErrorMessage(
          `Unable to open a result document: ${error.message}`
        );
      }
    );
  }

  async evaluatePlayground(): Promise<boolean> {
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
        const name = this.connectionController.getActiveConnectionName();
        const confirmRunAll = await vscode.window.showInformationMessage(
          `Are you sure you want to run this playground against ${name}? This confirmation can be disabled in the extension settings.`,
          { modal: true },
          'Yes'
        );

        if (confirmRunAll !== 'Yes') {
          return resolve(false);
        }
      }

      const evaluateResponse: ExecuteAllResult = await this.evaluateWithCancelModal();

      this._outputChannel.clear();
      if (evaluateResponse.outputLines) {
        for (const line of evaluateResponse.outputLines) {
          this._outputChannel.appendLine(line.content);
        }
        this._outputChannel.show(true);
      }

      if (!evaluateResponse.outputLines && !evaluateResponse.result) {
        return resolve(false);
      }

      this.playgroundResult = evaluateResponse.result;

      await this.openPlaygroundResult();

      return resolve(true);
    });
  }

  runSelectedPlaygroundBlocks(): Promise<boolean> {
    if (
      !this.activeTextEditor ||
      this.activeTextEditor.document.languageId !== 'mongodb'
    ) {
      vscode.window.showErrorMessage(
        "Please open a '.mongodb' playground file before running it."
      );

      return Promise.resolve(false);
    }

    const selections = this.activeTextEditor.selections;

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

    return this.evaluatePlayground();
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    if (
      !this.activeTextEditor ||
      this.activeTextEditor.document.languageId !== 'mongodb'
    ) {
      vscode.window.showErrorMessage(
        "Please open a '.mongodb' playground file before running it."
      );

      return Promise.resolve(false);
    }

    this._isPartialRun = false;
    this._codeToEvaluate = this.getAllText();

    return this.evaluatePlayground();
  }

  runAllOrSelectedPlaygroundBlocks(): Promise<boolean> {
    if (
      !this.activeTextEditor ||
      this.activeTextEditor.document.languageId !== 'mongodb'
    ) {
      vscode.window.showErrorMessage(
        "Please open a '.mongodb' playground file before running it."
      );

      return Promise.resolve(false);
    }

    const selections = this.activeTextEditor.selections;

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

    return this.evaluatePlayground();
  }

  openPlayground(filePath: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      vscode.workspace.openTextDocument(filePath).then((doc) => {
        vscode.window
          .showTextDocument(doc, { preview: false })
          .then(() => resolve(true), reject);
      }, reject);
    });
  }

  deactivate(): void {
    this.connectionController.removeEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        // No action is required after removing the listener.
      }
    );
  }
}
