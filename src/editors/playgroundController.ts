import * as vscode from 'vscode';
import { EJSON } from 'bson';

import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import { createLogger } from '../logging';
import { ExplorerController, ConnectionTreeItem, DatabaseTreeItem } from '../explorer';
import { LanguageServerController } from '../language';
import { OutputChannel, ProgressLocation, TextEditor } from 'vscode';
import playgroundCreateIndexTemplate from '../templates/playgroundCreateIndexTemplate';
import playgroundCreateCollectionTemplate from '../templates/playgroundCreateCollectionTemplate';
import playgroundCreateCollectionWithTSTemplate from '../templates/playgroundCreateCollectionWithTSTemplate';
import type { PlaygroundResult, ShellExecuteAllResult } from '../types/playgroundType';
import PlaygroundResultProvider, {
  PLAYGROUND_RESULT_SCHEME,
  PLAYGROUND_RESULT_URI
} from './playgroundResultProvider';
import playgroundSearchTemplate from '../templates/playgroundSearchTemplate';
import playgroundTemplate from '../templates/playgroundTemplate';
import { StatusView } from '../views';
import TelemetryService from '../telemetry/telemetryService';
import { ConnectionOptions } from '../types/connectionOptionsType';

const log = createLogger('playground controller');

const getSSLFilePathsFromConnectionModel = (
  connectionModelDriverOptions: ConnectionOptions
): {
  sslCA?: string | string[];
  sslCert?: string | string[];
  sslKey?: string | string[];
} => {
  const sslFilePaths = {};
  ['sslCA', 'sslCert', 'sslKey'].forEach((key) => {
    if (connectionModelDriverOptions[key]) {
      sslFilePaths[key] = connectionModelDriverOptions[key] as (
        string | string[]
      );
    }
  });

  return sslFilePaths;
};

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _connectionController: ConnectionController;
  _activeTextEditor?: TextEditor;
  _playgroundResult?: PlaygroundResult;
  _context: vscode.ExtensionContext;
  _languageServerController: LanguageServerController;
  _telemetryService: TelemetryService;
  _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  _outputChannel: OutputChannel;
  _connectionString?: string;
  _selectedText?: string;
  _codeToEvaluate = '';
  _isPartialRun: boolean;
  _playgroundResultViewColumn?: vscode.ViewColumn;
  _playgroundResultTextDocument?: vscode.TextDocument;
  _statusView: StatusView;
  _playgroundResultViewProvider: PlaygroundResultProvider;
  _explorerController: ExplorerController;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    languageServerController: LanguageServerController,
    telemetryService: TelemetryService,
    statusView: StatusView,
    playgroundResultViewProvider: PlaygroundResultProvider,
    activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider,
    explorerController: ExplorerController
  ) {
    this._context = context;
    this._isPartialRun = false;
    this._connectionController = connectionController;
    this._languageServerController = languageServerController;
    this._telemetryService = telemetryService;
    this._statusView = statusView;
    this._playgroundResultViewProvider = playgroundResultViewProvider;
    this._outputChannel = vscode.window.createOutputChannel(
      'Playground output'
    );
    this._activeConnectionCodeLensProvider = activeConnectionCodeLensProvider;
    this._explorerController = explorerController;

    this._connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        void this._connectToServiceProvider();
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
        this._activeTextEditor = editor;
        log.info('Active editor path', editor?.document.uri?.path);
      }
    };

    vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);
    onDidChangeActiveTextEditor(vscode.window.activeTextEditor);

    vscode.window.onDidChangeTextEditorSelection(
      (changeEvent: vscode.TextEditorSelectionChangeEvent) => {
        if (
          changeEvent?.textEditor?.document?.languageId === 'mongodb'
        ) {
          // Sort lines selected as the may be mis-ordered from alt+click.
          const sortedSelections = (changeEvent.selections as Array<vscode.Selection>)
            .sort((a, b) => (a.start.line > b.start.line ? 1 : -1));

          this._selectedText = sortedSelections
            .map((item) => this._getSelectedText(item))
            .join('\n');
        }
      }
    );
  }

  async _connectToServiceProvider(): Promise<void> {
    // Disconnect if already connected.
    await this._languageServerController.disconnectFromServiceProvider();

    const dataService = this._connectionController.getActiveDataService();
    const connectionId = this._connectionController.getActiveConnectionId();
    const connectionModel = this._connectionController
      .getActiveConnectionModel();

    if (!dataService || !connectionId || !connectionModel) {
      this._activeConnectionCodeLensProvider.refresh();

      return;
    }

    const connectionDetails = dataService.getConnectionOptions();
    const connectionString = connectionDetails.url;
    // We pass file paths to the language server since it doesn't
    // handle being passsed buffers well.
    // With driver version 4.0 we should be able to remove any use
    // of buffers and just pass file paths.
    const sslOptionsFilePaths = getSSLFilePathsFromConnectionModel(
      connectionModel.getAttributes({ derived: true }).driverOptions
    );

    const connectionOptions: ConnectionOptions = {
      ...connectionDetails.options,
      ...sslOptionsFilePaths
    };

    await this._languageServerController.connectToServiceProvider({
      connectionId,
      connectionString,
      connectionOptions
    });

    this._activeConnectionCodeLensProvider.refresh();
  }

  async _createPlaygroundFileWithContent(
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

      void vscode.window.showErrorMessage(
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

    return this._createPlaygroundFileWithContent(content);
  }

  async createPlaygroundForCreateCollection(
    element: ConnectionTreeItem | DatabaseTreeItem
  ): Promise<boolean> {
    const dataService = this._connectionController.getActiveDataService();
    let content = playgroundCreateCollectionTemplate;

    if (dataService) {
      const adminDb = dataService.client.client.db('admin');
      const buildInfo = await adminDb.command({ buildInfo: 1 });

      if (buildInfo) {
        const serverVersion = buildInfo.versionArray[0];

        if (serverVersion >= 5) {
          content = playgroundCreateCollectionWithTSTemplate;
        }
      }
    }

    element.cacheIsUpToDate = false;

    if (element instanceof DatabaseTreeItem) {
      content = content
        .replace('NEW_DATABASE_NAME', element.databaseName)
        .replace('Create a new database', 'The current database to use');
    }

    return this._createPlaygroundFileWithContent(content);
  }

  createPlaygroundForNewIndex(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    const content = playgroundCreateIndexTemplate
      .replace('CURRENT_DATABASE', databaseName)
      .replace('CURRENT_COLLECTION', collectionName);

    return this._createPlaygroundFileWithContent(content);
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

      void vscode.window.showErrorMessage(
        `Unable to create a playground: ${printableError.message}`
      );

      return false;
    }
  }

  async _evaluate(codeToEvaluate: string): Promise<ShellExecuteAllResult> {
    const connectionId = this._connectionController.getActiveConnectionId();

    if (!connectionId) {
      throw new Error('Please connect to a database before running a playground.');
    }

    this._statusView.showMessage('Getting results...');

    // Send a request to the language server to execute scripts from a playground.
    const result: ShellExecuteAllResult = await this._languageServerController.executeAll({
      codeToEvaluate,
      connectionId
    });

    this._statusView.hideMessage();
    this._telemetryService.trackPlaygroundCodeExecuted(
      result,
      this._isPartialRun,
      result ? false : true
    );

    return result;
  }

  _getAllText(): string {
    return this._activeTextEditor?.document.getText() || '';
  }

  _getSelectedText(selection: vscode.Range): string {
    return this._activeTextEditor?.document.getText(selection) || '';
  }

  async _evaluateWithCancelModal(): Promise<ShellExecuteAllResult> {
    if (!this._connectionController.isCurrentlyConnected()) {
      throw new Error('Please connect to a database before running a playground.');
    }

    try {
      const progressResult = await vscode.window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: 'Running MongoDB playground...',
          cancellable: true
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            // If a user clicked the cancel button terminate all playground scripts.
            this._languageServerController.cancelAll();

            return { outputLines: undefined, result: undefined };
          });

          // Run all playground scripts.
          const result: ShellExecuteAllResult = await this._evaluate(
            this._codeToEvaluate
          );

          return result;
        }
      );

      return progressResult;
    } catch (error) {
      log.error('Evaluate playground with cancel modal error', error);

      return {
        outputLines: undefined,
        result: undefined
      };
    }
  }

  _getDocumentLanguage(content?: EJSON.SerializableTypes): string {
    if (typeof content === 'object' && content !== null) {
      return 'json';
    }

    return 'plaintext';
  }

  async _openPlaygroundResult(): Promise<void> {
    this._playgroundResultViewProvider.setPlaygroundResult(
      this._playgroundResult
    );

    if (!this._playgroundResultTextDocument) {
      await this._openResultAsVirtualDocument();
    } else {
      this._refreshResultAsVirtualDocument();
    }

    await this._showResultAsVirtualDocument();

    if (this._playgroundResultTextDocument) {
      const language = this._getDocumentLanguage(this._playgroundResult?.content);

      await vscode.languages.setTextDocumentLanguage(
        this._playgroundResultTextDocument,
        language
      );
    }
  }

  _refreshResultAsVirtualDocument(): void {
    this._playgroundResultViewProvider.refresh();
  }

  async _showResultAsVirtualDocument(): Promise<void> {
    await vscode.window.showTextDocument(PLAYGROUND_RESULT_URI, {
      preview: false,
      preserveFocus: true,
      viewColumn: this._playgroundResultViewColumn || vscode.ViewColumn.Beside
    });
  }

  async _openResultAsVirtualDocument(): Promise<void> {
    try {
      this._playgroundResultTextDocument = await vscode.workspace.openTextDocument(
        PLAYGROUND_RESULT_URI
      );
    } catch (error) {
      const printableError = error as { message: string };

      void vscode.window.showErrorMessage(
        `Unable to open a result document: ${printableError.message}`
      );
    }
  }

  async _evaluatePlayground(): Promise<boolean> {
    const shouldConfirmRunAll = vscode.workspace
      .getConfiguration('mdb')
      .get('confirmRunAll');

    if (!this._connectionController.isCurrentlyConnected()) {
      void vscode.window.showErrorMessage(
        'Please connect to a database before running a playground.'
      );

      return false;
    }

    if (shouldConfirmRunAll === true) {
      const name = this._connectionController.getActiveConnectionName();
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

    const evaluateResponse: ShellExecuteAllResult = await this._evaluateWithCancelModal();

    if (evaluateResponse?.outputLines?.length) {
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

    this._playgroundResult = evaluateResponse.result;

    this._explorerController.refresh();

    await this._openPlaygroundResult();

    return true;
  }

  runSelectedPlaygroundBlocks(): Promise<boolean> {
    if (!this._selectedText) {
      void vscode.window.showInformationMessage(
        'Please select one or more lines in the playground.'
      );

      return Promise.resolve(true);
    }

    this._isPartialRun = true;
    this._codeToEvaluate = this._selectedText;

    return this._evaluatePlayground();
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    if (
      !this._activeTextEditor ||
      this._activeTextEditor.document.languageId !== 'mongodb'
    ) {
      void vscode.window.showErrorMessage(
        "Please open a '.mongodb' playground file before running it."
      );

      return Promise.resolve(false);
    }

    this._isPartialRun = false;
    this._codeToEvaluate = this._getAllText();

    return this._evaluatePlayground();
  }

  runAllOrSelectedPlaygroundBlocks(): Promise<boolean> {
    if (
      !this._activeTextEditor ||
      this._activeTextEditor.document.languageId !== 'mongodb'
    ) {
      void vscode.window.showErrorMessage(
        "Please open a '.mongodb' playground file before running it."
      );

      return Promise.resolve(false);
    }

    const selections = this._activeTextEditor.selections;

    if (
      !selections ||
      !Array.isArray(selections) ||
      (selections.length === 1 && this._getSelectedText(selections[0]) === '')
    ) {
      this._isPartialRun = false;
      this._codeToEvaluate = this._getAllText();
    } else if (this._selectedText) {
      this._isPartialRun = true;
      this._codeToEvaluate = this._selectedText;
    }

    return this._evaluatePlayground();
  }

  async openPlayground(filePath: string): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);

      await vscode.window.showTextDocument(document);

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      void vscode.window.showErrorMessage(
        `Unable to open a playground: ${printableError.message}`
      );

      return false;
    }
  }

  deactivate(): void {
    this._connectionController.removeEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        // No action is required after removing the listener.
      }
    );
  }
}
