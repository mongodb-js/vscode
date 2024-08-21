import * as vscode from 'vscode';
import path from 'path';
import type { TextEditor } from 'vscode';
import { ProgressLocation } from 'vscode';
import os from 'os';

import type ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import type PlaygroundSelectedCodeActionProvider from './playgroundSelectedCodeActionProvider';
import type ConnectionController from '../connectionController';
import { DataServiceEventTypes } from '../connectionController';
import { createLogger } from '../logging';
import type { ConnectionTreeItem } from '../explorer';
import { DatabaseTreeItem } from '../explorer';
import formatError from '../utils/formatError';
import type { LanguageServerController } from '../language';
import playgroundCreateIndexTemplate from '../templates/playgroundCreateIndexTemplate';
import playgroundCreateCollectionTemplate from '../templates/playgroundCreateCollectionTemplate';
import playgroundCloneDocumentTemplate from '../templates/playgroundCloneDocumentTemplate';
import playgroundInsertDocumentTemplate from '../templates/playgroundInsertDocumentTemplate';
import playgroundStreamsTemplate from '../templates/playgroundStreamsTemplate';
import playgroundCreateStreamProcessorTemplate from '../templates/playgroundCreateStreamProcessorTemplate';
import type {
  PlaygroundResult,
  ShellEvaluateResult,
  ThisDiagnosticFix,
  AllDiagnosticFixes,
} from '../types/playgroundType';
import type PlaygroundResultProvider from './playgroundResultProvider';
import {
  PLAYGROUND_RESULT_SCHEME,
  PLAYGROUND_RESULT_URI,
} from './playgroundResultProvider';
import playgroundSearchTemplate from '../templates/playgroundSearchTemplate';
import playgroundTemplate from '../templates/playgroundTemplate';
import type { StatusView } from '../views';
import type TelemetryService from '../telemetry/telemetryService';
import {
  isPlayground,
  getPlaygroundExtensionForTelemetry,
} from '../utils/playground';

const log = createLogger('playground controller');

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _connectionController: ConnectionController;
  _activeTextEditor?: TextEditor;
  _playgroundResult?: PlaygroundResult;
  _languageServerController: LanguageServerController;
  _selectedText?: string;
  _playgroundSelectedCodeActionProvider: PlaygroundSelectedCodeActionProvider;
  _telemetryService: TelemetryService;

  _isPartialRun = false;

  private _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  private _playgroundResultViewColumn?: vscode.ViewColumn;
  private _playgroundResultTextDocument?: vscode.TextDocument;
  private _statusView: StatusView;
  private _playgroundResultViewProvider: PlaygroundResultProvider;

  private _codeToEvaluate = '';

  constructor({
    connectionController,
    languageServerController,
    telemetryService,
    statusView,
    playgroundResultViewProvider,
    activeConnectionCodeLensProvider,
    playgroundSelectedCodeActionProvider,
  }: {
    connectionController: ConnectionController;
    languageServerController: LanguageServerController;
    telemetryService: TelemetryService;
    statusView: StatusView;
    playgroundResultViewProvider: PlaygroundResultProvider;
    activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
    playgroundSelectedCodeActionProvider: PlaygroundSelectedCodeActionProvider;
  }) {
    this._connectionController = connectionController;
    this._activeTextEditor = vscode.window.activeTextEditor;
    this._languageServerController = languageServerController;
    this._telemetryService = telemetryService;
    this._statusView = statusView;
    this._playgroundResultViewProvider = playgroundResultViewProvider;
    this._activeConnectionCodeLensProvider = activeConnectionCodeLensProvider;
    this._playgroundSelectedCodeActionProvider =
      playgroundSelectedCodeActionProvider;

    this._connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      () => {
        void this._activeConnectionChanged();
      }
    );

    const onDidChangeActiveTextEditor = (
      editor: vscode.TextEditor | undefined
    ) => {
      if (editor?.document.uri.scheme === PLAYGROUND_RESULT_SCHEME) {
        this._playgroundResultViewColumn = editor.viewColumn;
        this._playgroundResultTextDocument = editor?.document;
      }
      const isPlaygroundEditor = isPlayground(editor?.document.uri);

      void vscode.commands.executeCommand(
        'setContext',
        'mdb.isPlayground',
        isPlaygroundEditor
      );

      if (isPlaygroundEditor) {
        this._activeTextEditor = editor;
        this._activeConnectionCodeLensProvider.setActiveTextEditor(
          this._activeTextEditor
        );
        log.info('Active editor', {
          documentPath: editor?.document.uri?.path,
          documentLanguageId: editor?.document.languageId,
        });
      }
    };

    vscode.workspace.textDocuments.forEach((document) => {
      if (isPlayground(document.uri)) {
        void vscode.languages.setTextDocumentLanguage(document, 'javascript');
      }
    });

    vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);
    onDidChangeActiveTextEditor(vscode.window.activeTextEditor);

    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (isPlayground(document.uri)) {
        // TODO: re-enable with fewer 'Playground Loaded' events
        // https://jira.mongodb.org/browse/VSCODE-432
        /* this._telemetryService.trackPlaygroundLoaded(
          getPlaygroundExtensionForTelemetry(document.uri)
        ); */
        await vscode.languages.setTextDocumentLanguage(document, 'javascript');
      }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isPlayground(document.uri)) {
        this._telemetryService.trackPlaygroundSaved(
          getPlaygroundExtensionForTelemetry(document.uri)
        );
      }
    });
  }

  async _activeConnectionChanged(): Promise<void> {
    const dataService = this._connectionController.getActiveDataService();
    const connectionId = this._connectionController.getActiveConnectionId();
    let mongoClientOption;

    this._activeConnectionCodeLensProvider.refresh();

    if (dataService && connectionId) {
      mongoClientOption =
        this._connectionController.getMongoClientConnectionOptions();
    }

    // The connectionId is null when disconnecting.
    await this._languageServerController.activeConnectionChanged({
      connectionId,
      connectionString: mongoClientOption?.url,
      connectionOptions: mongoClientOption?.options,
    });
  }

  async _createPlaygroundFileWithContent(
    content: string | undefined
  ): Promise<boolean> {
    try {
      // The MacOS default folder for saving files is a read-only root (/) directory,
      // therefore we explicitly specify the workspace folder path
      // or OS home directory if a user has not opened workspaces.
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const filePath = workspaceFolder?.uri.fsPath || os.homedir();

      // We count open untitled playground files to use this number as part of a new playground path.
      const numberUntitledPlaygrounds = vscode.workspace.textDocuments.filter(
        (doc) => isPlayground(doc.uri)
      ).length;

      // We need a secondary `mongodb` extension otherwise VSCode will
      // suggest playground-1.js name when saving playground to the disk.
      // Users can open playgrounds from the disk
      // and we need a way to distinguish this files from regular JS files.
      const fileName = path.join(
        filePath,
        `playground-${numberUntitledPlaygrounds + 1}.mongodb.js`
      );

      // Does not create a physical file, it only creates a URI from specified component parts.
      // An untitled file URI: untitled:/extensionPath/playground-1.mongodb.js
      const documentUri = vscode.Uri.from({
        path: fileName,
        scheme: 'untitled',
      });

      // Fill in initial content.
      const edit = new vscode.WorkspaceEdit();
      edit.insert(documentUri, new vscode.Position(0, 0), `${content}`);
      await vscode.workspace.applyEdit(edit);

      // Actually show the editor.
      // We open playgrounds by URI to use the secondary `mongodb` extension
      // as an identifier that distinguishes them from regular JS files.
      const document = await vscode.workspace.openTextDocument(documentUri);

      // Focus new text document.
      await vscode.window.showTextDocument(document);

      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a playground: ${formatError(error).message}`
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

    this._telemetryService.trackPlaygroundCreated('search');
    return this._createPlaygroundFileWithContent(content);
  }

  async createPlaygroundForCreateCollection(
    element: ConnectionTreeItem | DatabaseTreeItem
  ): Promise<boolean> {
    let content = playgroundCreateCollectionTemplate;

    element.cacheIsUpToDate = false;

    if (element instanceof DatabaseTreeItem) {
      content = content
        .replace('NEW_DATABASE_NAME', element.databaseName)
        .replace('Create a new database', 'The current database to use');
      this._telemetryService.trackPlaygroundCreated('createCollection');
    } else {
      this._telemetryService.trackPlaygroundCreated('createDatabase');
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

    this._telemetryService.trackPlaygroundCreated('index');
    return this._createPlaygroundFileWithContent(content);
  }

  createPlaygroundForCloneDocument(
    documentContents: string,
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    const content = playgroundCloneDocumentTemplate
      .replace('CURRENT_DATABASE', databaseName)
      .replace('CURRENT_COLLECTION', collectionName)
      .replace('DOCUMENT_CONTENTS', documentContents);

    this._telemetryService.trackPlaygroundCreated('cloneDocument');
    return this._createPlaygroundFileWithContent(content);
  }

  createPlaygroundForInsertDocument(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    const content = playgroundInsertDocumentTemplate
      .replace('CURRENT_DATABASE', databaseName)
      .replace('CURRENT_COLLECTION', collectionName);

    this._telemetryService.trackPlaygroundCreated('insertDocument');
    return this._createPlaygroundFileWithContent(content);
  }

  async createPlaygroundForCreateStreamProcessor(
    element: ConnectionTreeItem
  ): Promise<boolean> {
    const content = playgroundCreateStreamProcessorTemplate;

    element.cacheIsUpToDate = false;

    this._telemetryService.trackPlaygroundCreated('createStreamProcessor');

    return this._createPlaygroundFileWithContent(content);
  }

  async createPlayground(): Promise<boolean> {
    const useDefaultTemplate = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useDefaultTemplateForPlayground');
    const isStreams = this._connectionController.isConnectedToAtlasStreams();
    const template = isStreams ? playgroundStreamsTemplate : playgroundTemplate;
    const content = useDefaultTemplate ? template : '';

    this._telemetryService.trackPlaygroundCreated('crud');
    return this._createPlaygroundFileWithContent(content);
  }

  async _evaluate(codeToEvaluate: string): Promise<ShellEvaluateResult> {
    const connectionId = this._connectionController.getActiveConnectionId();

    if (!connectionId) {
      throw new Error(
        'Please connect to a database before running a playground.'
      );
    }

    this._statusView.showMessage('Getting results...');

    let result: ShellEvaluateResult;
    try {
      // Send a request to the language server to execute scripts from a playground.
      result = await this._languageServerController.evaluate({
        codeToEvaluate,
        connectionId,
        filePath: vscode.window.activeTextEditor?.document.uri.fsPath,
      });
    } catch (error) {
      const msg =
        'An internal error has occurred. The playground services have been restored. This can occur when the playground runner runs out of memory.';
      log.error(msg, error);
      void vscode.window.showErrorMessage(msg);
    }

    this._statusView.hideMessage();
    this._telemetryService.trackPlaygroundCodeExecuted(
      result,
      this._isPartialRun,
      result ? false : true
    );

    return result;
  }

  _getAllText(): string {
    return this._activeTextEditor?.document.getText().trim() || '';
  }

  _getSelectedText(selection: vscode.Range): string {
    return this._activeTextEditor?.document.getText(selection) || '';
  }

  async _evaluateWithCancelModal(): Promise<ShellEvaluateResult> {
    if (!this._connectionController.isCurrentlyConnected()) {
      throw new Error(
        'Please connect to a database before running a playground.'
      );
    }

    try {
      const progressResult = await vscode.window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: 'Running MongoDB playground...',
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            // If a user clicked the cancel button terminate all playground scripts.
            this._languageServerController.cancelAll();

            return { result: undefined };
          });

          // Run all playground scripts.
          const result: ShellEvaluateResult = await this._evaluate(
            this._codeToEvaluate
          );

          return result;
        }
      );

      return progressResult;
    } catch (error) {
      log.error('Evaluating playground with cancel modal failed', error);

      return { result: undefined };
    }
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
      const language = this._playgroundResult?.language || 'plaintext';

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
      viewColumn: this._playgroundResultViewColumn || vscode.ViewColumn.Beside,
    });
  }

  async _openResultAsVirtualDocument(): Promise<void> {
    try {
      this._playgroundResultTextDocument =
        await vscode.workspace.openTextDocument(PLAYGROUND_RESULT_URI);
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to open a result document: ${formatError(error).message}`
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

    const evaluateResponse: ShellEvaluateResult =
      await this._evaluateWithCancelModal();

    if (!evaluateResponse || !evaluateResponse.result) {
      return false;
    }

    this._playgroundResult = evaluateResponse.result;

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
      !isPlayground(this._activeTextEditor.document.uri)
    ) {
      void vscode.window.showErrorMessage(
        'Please open a MongoDB playground file before running it.'
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
      !isPlayground(this._activeTextEditor.document.uri)
    ) {
      void vscode.window.showErrorMessage(
        'Please open a MongoDB playground file before running it.'
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

  async fixThisInvalidInteractiveSyntax({
    documentUri,
    range,
    fix,
  }: ThisDiagnosticFix) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(documentUri, range, fix);
    await vscode.workspace.applyEdit(edit);
    return true;
  }

  async fixAllInvalidInteractiveSyntax({
    documentUri,
    diagnostics,
  }: AllDiagnosticFixes) {
    const edit = new vscode.WorkspaceEdit();

    for (const { range, fix } of diagnostics) {
      edit.replace(documentUri, range, fix);
    }

    await vscode.workspace.applyEdit(edit);
    return true;
  }

  async openPlayground(filePath: string): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);

      await vscode.window.showTextDocument(document);

      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to open a playground: ${formatError(error).message}`
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
