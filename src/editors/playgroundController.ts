import * as vscode from 'vscode';
import path from 'path';
import { ProgressLocation } from 'vscode';
import os from 'os';

import type PlaygroundSelectionCodeActionProvider from './playgroundSelectionCodeActionProvider';
import type ConnectionController from '../connectionController';
import { DataServiceEventTypes } from '../connectionController';
import { createLogger } from '../logging';
import type { ConnectionTreeItem } from '../explorer';
import { CollectionTreeItem } from '../explorer';
import { DatabaseTreeItem } from '../explorer';
import formatError from '../utils/formatError';
import type { LanguageServerController } from '../language';
import playgroundBasicTextTemplate from '../templates/playgroundBasicTextTemplate';
import playgroundCreateIndexTemplate from '../templates/playgroundCreateIndexTemplate';
import playgroundCreateCollectionTemplate from '../templates/playgroundCreateCollectionTemplate';
import playgroundCloneDocumentTemplate from '../templates/playgroundCloneDocumentTemplate';
import playgroundInsertDocumentTemplate from '../templates/playgroundInsertDocumentTemplate';
import playgroundStreamsTemplate from '../templates/playgroundStreamsTemplate';
import playgroundCreateStreamProcessorTemplate from '../templates/playgroundCreateStreamProcessorTemplate';
import {
  type ShellEvaluateResult,
  type ThisDiagnosticFix,
  type AllDiagnosticFixes,
  type PlaygroundRunResult,
  type ExportToLanguageResult,
} from '../types/playgroundType';
import type PlaygroundResultProvider from './playgroundResultProvider';
import {
  PLAYGROUND_RESULT_SCHEME,
  PLAYGROUND_RESULT_URI,
} from './playgroundResultProvider';
import playgroundSearchTemplate from '../templates/playgroundSearchTemplate';
import playgroundTemplate from '../templates/playgroundTemplate';
import type { StatusView } from '../views';
import type TelemetryService from '../telemetry';
import { isPlayground, getSelectedText, getAllText } from '../utils/playground';
import type ExportToLanguageCodeLensProvider from './exportToLanguageCodeLensProvider';
import { playgroundFromDatabaseTreeItemTemplate } from '../templates/playgroundFromDatabaseTreeItemTemplate';
import { playgroundFromCollectionTreeItemTemplate } from '../templates/playgroundFromCollectionTreeItemTemplate';
import {
  PlaygroundCreatedTelemetryEvent,
  PlaygroundExecutedTelemetryEvent,
  PlaygroundSavedTelemetryEvent,
} from '../telemetry';

const log = createLogger('playground controller');

function getActiveEditorFilePath(): string | undefined {
  return vscode.window.activeTextEditor?.document.uri.fsPath;
}

const connectBeforeRunningMessage =
  'Please connect to a database before running a playground.';

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _connectionController: ConnectionController;
  _playgroundResult?: PlaygroundRunResult | ExportToLanguageResult;
  _languageServerController: LanguageServerController;
  _playgroundSelectionCodeActionProvider: PlaygroundSelectionCodeActionProvider;
  _telemetryService: TelemetryService;
  _exportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;

  _isPartialRun = false;

  private _playgroundResultViewColumn?: vscode.ViewColumn;
  private _playgroundResultTextDocument?: vscode.TextDocument;
  private _statusView: StatusView;
  private _playgroundResultProvider: PlaygroundResultProvider;
  private _activeConnectionChangedHandler: () => void;

  constructor({
    connectionController,
    languageServerController,
    telemetryService,
    statusView,
    playgroundResultProvider,
    playgroundSelectionCodeActionProvider,
    exportToLanguageCodeLensProvider,
  }: {
    connectionController: ConnectionController;
    languageServerController: LanguageServerController;
    telemetryService: TelemetryService;
    statusView: StatusView;
    playgroundResultProvider: PlaygroundResultProvider;
    playgroundSelectionCodeActionProvider: PlaygroundSelectionCodeActionProvider;
    exportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
  }) {
    this._connectionController = connectionController;
    this._languageServerController = languageServerController;
    this._telemetryService = telemetryService;
    this._statusView = statusView;
    this._playgroundResultProvider = playgroundResultProvider;
    this._playgroundSelectionCodeActionProvider =
      playgroundSelectionCodeActionProvider;
    this._exportToLanguageCodeLensProvider = exportToLanguageCodeLensProvider;

    this._activeConnectionChangedHandler = (): void => {
      void this._activeConnectionChanged();
    };
    this._connectionController.addEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      this._activeConnectionChangedHandler
    );

    const onDidChangeActiveTextEditor = (
      editor: vscode.TextEditor | undefined
    ): void => {
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
        // this._telemetryService.track(new PlaygroundLoadedTelemetryEvent(document.uri));
        await vscode.languages.setTextDocumentLanguage(document, 'javascript');
      }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isPlayground(document.uri)) {
        this._telemetryService.track(
          new PlaygroundSavedTelemetryEvent(document.uri)
        );
      }
    });
  }

  async _activeConnectionChanged(): Promise<void> {
    const dataService = this._connectionController.getActiveDataService();
    const connectionId = this._connectionController.getActiveConnectionId();
    let mongoClientOption;

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

    this._telemetryService.track(new PlaygroundCreatedTelemetryEvent('search'));
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
      this._telemetryService.track(
        new PlaygroundCreatedTelemetryEvent('createCollection')
      );
    } else {
      this._telemetryService.track(
        new PlaygroundCreatedTelemetryEvent('createDatabase')
      );
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

    this._telemetryService.track(new PlaygroundCreatedTelemetryEvent('index'));
    return this._createPlaygroundFileWithContent(content);
  }

  createPlaygroundFromParticipantCode({
    text,
  }: {
    text: string;
  }): Promise<boolean> {
    const useDefaultTemplate = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useDefaultTemplateForPlayground');
    const content = useDefaultTemplate
      ? playgroundBasicTextTemplate.replace('PLAYGROUND_CONTENT', text)
      : text;
    this._telemetryService.track(new PlaygroundCreatedTelemetryEvent('agent'));
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

    this._telemetryService.track(
      new PlaygroundCreatedTelemetryEvent('cloneDocument')
    );
    return this._createPlaygroundFileWithContent(content);
  }

  createPlaygroundForInsertDocument(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    const content = playgroundInsertDocumentTemplate
      .replace('CURRENT_DATABASE', databaseName)
      .replace('CURRENT_COLLECTION', collectionName);

    this._telemetryService.track(
      new PlaygroundCreatedTelemetryEvent('insertDocument')
    );
    return this._createPlaygroundFileWithContent(content);
  }

  async createPlaygroundForCreateStreamProcessor(
    element: ConnectionTreeItem
  ): Promise<boolean> {
    const content = playgroundCreateStreamProcessorTemplate;

    element.cacheIsUpToDate = false;

    this._telemetryService.track(
      new PlaygroundCreatedTelemetryEvent('createStreamProcessor')
    );

    return this._createPlaygroundFileWithContent(content);
  }

  async createPlaygroundFromTreeItem(
    treeItem: DatabaseTreeItem | CollectionTreeItem
  ): Promise<boolean> {
    let content = '';
    if (treeItem instanceof DatabaseTreeItem) {
      content = playgroundFromDatabaseTreeItemTemplate(treeItem.databaseName);
      this._telemetryService.track(
        new PlaygroundCreatedTelemetryEvent('fromDatabaseTreeItem')
      );
    } else if (treeItem instanceof CollectionTreeItem) {
      content = playgroundFromCollectionTreeItemTemplate(
        treeItem.databaseName,
        treeItem.collectionName
      );
      this._telemetryService.track(
        new PlaygroundCreatedTelemetryEvent('fromCollectionTreeItem')
      );
    }

    return this._createPlaygroundFileWithContent(content);
  }

  async createPlayground(): Promise<boolean> {
    const useDefaultTemplate = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useDefaultTemplateForPlayground');
    let content = '';
    if (useDefaultTemplate) {
      const isStreams = this._connectionController.isConnectedToAtlasStreams();
      const template = isStreams
        ? playgroundStreamsTemplate
        : playgroundTemplate;
      content = template;
    }

    this._telemetryService.track(new PlaygroundCreatedTelemetryEvent('crud'));
    return this._createPlaygroundFileWithContent(content);
  }

  async _evaluate(
    {
      codeToEvaluate,
      filePath,
    }: {
      codeToEvaluate: string;
      filePath?: string;
    },
    token: vscode.CancellationToken
  ): Promise<ShellEvaluateResult> {
    const connectionId = this._connectionController.getActiveConnectionId();

    if (!connectionId) {
      throw new Error(connectBeforeRunningMessage);
    }

    this._statusView.showMessage('Getting results...');

    let result: ShellEvaluateResult = null;
    try {
      // Send a request to the language server to execute scripts from a playground.
      result = await this._languageServerController.evaluate(
        {
          codeToEvaluate,
          connectionId,
          filePath,
        },
        token
      );
    } catch (error) {
      const msg =
        'An internal error has occurred. The playground services have been restored. This can occur when the playground runner runs out of memory.';
      log.error(msg, error);
      void vscode.window.showErrorMessage(msg);
    }

    this._statusView.hideMessage();
    this._telemetryService.track(
      new PlaygroundExecutedTelemetryEvent(
        result,
        this._isPartialRun,
        result ? false : true
      )
    );

    return result;
  }

  async _evaluateWithCancelModal({
    codeToEvaluate,
    filePath,
  }: {
    codeToEvaluate: string;
    filePath?: string;
  }): Promise<ShellEvaluateResult> {
    if (!this._connectionController.isCurrentlyConnected()) {
      throw new Error(connectBeforeRunningMessage);
    }

    return await vscode.window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Running MongoDB playground...',
        cancellable: true,
      },
      (progress, token): Promise<ShellEvaluateResult> => {
        return this._evaluate(
          {
            codeToEvaluate,
            filePath,
          },
          token
        );
      }
    );
  }

  async _openInResultPane(
    result: PlaygroundRunResult | ExportToLanguageResult
  ): Promise<void> {
    this._playgroundResultProvider.setPlaygroundResult(result);

    if (!this._playgroundResultTextDocument) {
      await this._openResultAsVirtualDocument();
    } else {
      this._refreshResultAsVirtualDocument();
    }

    await this._showResultAsVirtualDocument();

    if (this._playgroundResultTextDocument) {
      const language = result?.language || 'plaintext';

      await vscode.languages.setTextDocumentLanguage(
        this._playgroundResultTextDocument,
        language
      );
    }
  }

  _refreshResultAsVirtualDocument(): void {
    this._playgroundResultProvider.refresh();
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

  async evaluateParticipantCode(codeToEvaluate: string): Promise<boolean> {
    const shouldConfirmRunCopilotCode = vscode.workspace
      .getConfiguration('mdb')
      .get('confirmRunCopilotCode');

    if (!this._connectionController.isCurrentlyConnected()) {
      const successfullyConnected =
        await this._connectionController.changeActiveConnection();

      if (!successfullyConnected) {
        void vscode.window.showErrorMessage(connectBeforeRunningMessage);
        return false;
      }
    }

    if (shouldConfirmRunCopilotCode === true) {
      const name = this._connectionController.getActiveConnectionName();
      const confirmRunCopilotCode = await vscode.window.showInformationMessage(
        `Are you sure you want to run this code generated by the MongoDB participant against ${name}? This confirmation can be disabled in the extension settings.`,
        { modal: true },
        'Yes'
      );

      if (confirmRunCopilotCode !== 'Yes') {
        return false;
      }
    }

    const evaluateResponse: ShellEvaluateResult =
      await this._evaluateWithCancelModal({
        codeToEvaluate,
      });

    if (!evaluateResponse || !evaluateResponse.result) {
      return false;
    }

    await this._openInResultPane(evaluateResponse.result);

    return true;
  }

  async showExportToLanguageResult(
    result: ExportToLanguageResult
  ): Promise<boolean> {
    await this._openInResultPane(result);
    return true;
  }

  async _evaluatePlayground({
    codeToEvaluate,
    filePath,
  }: {
    codeToEvaluate: string;
    filePath?: string;
  }): Promise<boolean> {
    const shouldConfirmRunAll = vscode.workspace
      .getConfiguration('mdb')
      .get('confirmRunAll');

    if (!this._connectionController.isCurrentlyConnected()) {
      void vscode.window.showErrorMessage(connectBeforeRunningMessage);

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
      await this._evaluateWithCancelModal({
        codeToEvaluate,
        filePath,
      });

    if (!evaluateResponse || !evaluateResponse.result) {
      return false;
    }

    this._playgroundResult = evaluateResponse.result;
    await this._openInResultPane(this._playgroundResult);

    return true;
  }

  runSelectedPlaygroundBlocks(): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    const selectedText = getSelectedText();

    if (!isPlayground(editor?.document.uri) || !getSelectedText()) {
      void vscode.window.showInformationMessage(
        'Please select one or more lines in the playground.'
      );
      return Promise.resolve(false);
    }

    this._isPartialRun = true;

    return this._evaluatePlayground({
      codeToEvaluate: selectedText || '',
      filePath: getActiveEditorFilePath(),
    });
  }

  runAllPlaygroundBlocks(): Promise<boolean> {
    const codeToEvaluate = getAllText();

    if (!codeToEvaluate) {
      void vscode.window.showErrorMessage(
        'Please open a MongoDB playground file before running it.'
      );
      return Promise.resolve(false);
    }

    this._isPartialRun = false;

    return this._evaluatePlayground({
      codeToEvaluate,
      filePath: getActiveEditorFilePath(),
    });
  }

  runAllOrSelectedPlaygroundBlocks(): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    const selectedText = getSelectedText();
    const codeToEvaluate = selectedText || getAllText();

    this._isPartialRun = !!selectedText;

    if (!isPlayground(editor?.document.uri)) {
      void vscode.window.showErrorMessage(
        'Please open a MongoDB playground file before running it.'
      );
      return Promise.resolve(false);
    }

    return this._evaluatePlayground({
      codeToEvaluate,
      filePath: getActiveEditorFilePath(),
    });
  }

  async fixThisInvalidInteractiveSyntax({
    documentUri,
    range,
    fix,
  }: ThisDiagnosticFix): Promise<boolean> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(documentUri, range, fix);
    await vscode.workspace.applyEdit(edit);
    return true;
  }

  async fixAllInvalidInteractiveSyntax({
    documentUri,
    diagnostics,
  }: AllDiagnosticFixes): Promise<boolean> {
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
      this._activeConnectionChangedHandler
    );
  }
}
