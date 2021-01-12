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
  PLAYGROUND_RESULT_SCHEME,
  PLAYGROUND_RESULT_URI
} from './playgroundResultProvider';
import type { OutputItem } from '../utils/types';
import { StatusView } from '../views';
import { EJSON } from 'bson';

const log = createLogger('playground controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  connectionController: ConnectionController;
  activeTextEditor?: TextEditor;
  playgroundResult?: OutputItem;
  _context: vscode.ExtensionContext;
  _languageServerController: LanguageServerController;
  _telemetryController: TelemetryController;
  _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  _partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider;
  _outputChannel: OutputChannel;
  _connectionString?: string;
  _connectionOptions?: EJSON.SerializableTypes;
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
    statusView: StatusView,
    playgroundResultViewProvider: PlaygroundResultProvider,
    activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider,
    partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider
  ) {
    this._context = context;
    this._codeToEvaluate = '';
    this._isPartialRun = false;
    this.connectionController = connectionController;
    this._languageServerController = languageServerController;
    this._telemetryController = telemetryController;
    this._statusView = statusView;
    this._playgroundResultViewProvider = playgroundResultViewProvider;
    this._outputChannel = vscode.window.createOutputChannel(
      'Playground output'
    );
    this._activeConnectionCodeLensProvider = activeConnectionCodeLensProvider;
    this._partialExecutionCodeLensProvider = partialExecutionCodeLensProvider;

    this.connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        this.disconnectFromServiceProvider();
      }
    );

    this.connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        this.connectToServiceProvider();
      }
    );

    const onDidChangeActiveTextEditor = (
      editor: vscode.TextEditor | undefined
    ) => {
      if (editor?.document.uri.scheme === PLAYGROUND_RESULT_SCHEME) {
        this._playgroundResultViewColumn = editor.viewColumn;
        this._playgroundResultTextDocument = editor?.document;
      }

      if (editor?.document.languageId !== 'Log') {
        this.activeTextEditor = editor;
        log.info('Active editor path', editor?.document.uri?.path);
      }
    };

    vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);
    onDidChangeActiveTextEditor(vscode.window.activeTextEditor);

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
      this._partialExecutionCodeLensProvider?.refresh(
        new vscode.Range(firstLine, 0, firstLine, 0)
      );
    } else {
      this._partialExecutionCodeLensProvider?.refresh();
    }
  }

  disconnectFromServiceProvider(): void {
    this._languageServerController.disconnectFromServiceProvider();
  }

  async connectToServiceProvider(): Promise<void> {
    const model = this.connectionController
      .getActiveConnectionModel()
      ?.getAttributes({ derived: true });

    this._connectionString = undefined;
    this._connectionOptions = undefined;

    await this._languageServerController.disconnectFromServiceProvider();

    if (model && model.driverUrlWithSsh) {
      this._connectionString = model.driverUrlWithSsh;
      this._connectionOptions = model.driverOptions ? model.driverOptions : {};

      await this._languageServerController.connectToServiceProvider({
        connectionString: this._connectionString,
        connectionOptions: this._connectionOptions,
        extensionPath: this._context.extensionPath
      });
    }

    this._activeConnectionCodeLensProvider?.refresh();
  }

  async createPlaygroundFileWithContent(
    content: string | undefined
  ): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument({
        language: 'mongodb',
        content
      });

      await vscode.window.showTextDocument(document);

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(
        `Unable to create a playground: ${printableError.message}`
      );

      return false;
    }
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

  async createPlayground(): Promise<boolean> {
    const useDefaultTemplate = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useDefaultTemplateForPlayground');

    try {
      const document = await vscode.workspace.openTextDocument({
        language: 'mongodb',
        content: useDefaultTemplate ? playgroundTemplate : ''
      });

      await vscode.window.showTextDocument(document);

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(
        `Unable to create a playground: ${printableError.message}`
      );

      return false;
    }
  }

  async evaluate(codeToEvaluate: string): Promise<ExecuteAllResult> {
    this._statusView.showMessage('Getting results...');

    // Send a request to the language server to execute scripts from a playground.
    const result: ExecuteAllResult = await this._languageServerController.executeAll(
      codeToEvaluate
    );

    this._statusView.hideMessage();
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

  getDocumentLanguage(content?: EJSON.SerializableTypes): string {
    if (typeof content === 'object' && content !== null) {
      return 'json';
    }

    return 'plaintext';
  }

  async openPlaygroundResult(): Promise<void> {
    this._playgroundResultViewProvider.setPlaygroundResult(
      this.playgroundResult
    );

    if (!this._playgroundResultTextDocument) {
      await this.openResultAsVirtualDocument();
    } else {
      this.refreshResultAsVirtualDocument();
    }

    await this.showResultAsVirtualDocument();

    if (this._playgroundResultTextDocument) {
      const language = this.getDocumentLanguage(this.playgroundResult?.content);

      await vscode.languages.setTextDocumentLanguage(
        this._playgroundResultTextDocument,
        language
      );
    }
  }

  refreshResultAsVirtualDocument(): void {
    this._playgroundResultViewProvider.refresh();
  }

  async showResultAsVirtualDocument(): Promise<void> {
    await vscode.window.showTextDocument(PLAYGROUND_RESULT_URI, {
      preview: false,
      viewColumn: this._playgroundResultViewColumn || vscode.ViewColumn.Beside
    });
  }

  async openResultAsVirtualDocument(): Promise<void> {
    try {
      this._playgroundResultTextDocument = await vscode.workspace.openTextDocument(
        PLAYGROUND_RESULT_URI
      );
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(
        `Unable to open a result document: ${printableError.message}`
      );
    }
  }

  async evaluatePlayground(): Promise<boolean> {
    const shouldConfirmRunAll = vscode.workspace
      .getConfiguration('mdb')
      .get('confirmRunAll');

    if (!this._connectionString) {
      vscode.window.showErrorMessage(
        'Please connect to a database before running a playground.'
      );

      return false;
    }

    if (shouldConfirmRunAll === true) {
      const name = this.connectionController.getActiveConnectionName();
      const confirmRunAll = await vscode.window.showInformationMessage(
        `Are you sure you want to run this playground against ${name}? This confirmation can be disabled in the extension settings.`,
        { modal: true },
        'Yes'
      );

      if (confirmRunAll !== 'Yes') {
        return false;
      }
    }

    this._outputChannel.clear();

    const evaluateResponse: ExecuteAllResult = await this.evaluateWithCancelModal();

    if (
      evaluateResponse &&
      evaluateResponse.outputLines &&
      evaluateResponse.outputLines.length > 0
    ) {
      for (const line of evaluateResponse.outputLines) {
        this._outputChannel.appendLine(line.content);
      }

      this._outputChannel.show(true);
    }

    if (
      !evaluateResponse ||
      (!evaluateResponse.outputLines && !evaluateResponse.result)
    ) {
      return false;
    }

    this.playgroundResult = evaluateResponse.result;

    await this.openPlaygroundResult();

    return true;
  }

  async runSelectedPlaygroundBlocks(): Promise<boolean> {
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

  async runAllPlaygroundBlocks(): Promise<boolean> {
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

  async runAllOrSelectedPlaygroundBlocks(): Promise<boolean> {
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

  async openPlayground(filePath: string): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);

      await vscode.window.showTextDocument(document);

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(
        `Unable to open a playground: ${printableError.message}`
      );

      return false;
    }
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
