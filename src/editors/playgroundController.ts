import * as vscode from 'vscode';
import path from 'path';
import type { TextEditor } from 'vscode';
import { ProgressLocation } from 'vscode';
import vm from 'vm';
import os from 'os';
import transpiler from 'bson-transpilers';

import type ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import type PlaygroundSelectedCodeActionProvider from './playgroundSelectedCodeActionProvider';
import type ConnectionController from '../connectionController';
import { DataServiceEventTypes } from '../connectionController';
import { createLogger } from '../logging';
import type { ConnectionTreeItem } from '../explorer';
import { DatabaseTreeItem } from '../explorer';
import type ExportToLanguageCodeLensProvider from './exportToLanguageCodeLensProvider';
import formatError from '../utils/formatError';
import type { LanguageServerController } from '../language';
import playgroundBasicTextTemplate from '../templates/playgroundBasicTextTemplate';
import playgroundCreateIndexTemplate from '../templates/playgroundCreateIndexTemplate';
import playgroundCreateCollectionTemplate from '../templates/playgroundCreateCollectionTemplate';
import playgroundCloneDocumentTemplate from '../templates/playgroundCloneDocumentTemplate';
import playgroundInsertDocumentTemplate from '../templates/playgroundInsertDocumentTemplate';
import playgroundStreamsTemplate from '../templates/playgroundStreamsTemplate';
import playgroundCreateStreamProcessorTemplate from '../templates/playgroundCreateStreamProcessorTemplate';
import type {
  PlaygroundResult,
  ShellEvaluateResult,
  ExportToLanguageAddons,
  ExportToLanguageNamespace,
  ThisDiagnosticFix,
  AllDiagnosticFixes,
} from '../types/playgroundType';
import { ExportToLanguageMode } from '../types/playgroundType';
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
import type ParticipantController from '../participant/participant';

const log = createLogger('playground controller');

interface ToCompile {
  filter?: string;
  aggregation?: string;
  options: {
    collection: string | null;
    database: string | null;
    uri?: string;
  };
}

let dummySandbox;

// TODO: this function was copied from the compass-export-to-language module
// https://github.com/mongodb-js/compass/blob/7c4bc0789a7b66c01bb7ba63955b3b11ed40c094/packages/compass-export-to-language/src/modules/count-aggregation-stages-in-string.js
// and should be updated as well when the better solution for the problem will be found.
const countAggregationStagesInString = (str: string) => {
  if (!dummySandbox) {
    dummySandbox = vm.createContext(Object.create(null), {
      codeGeneration: { strings: false, wasm: false },
      microtaskMode: 'afterEvaluate',
    });
    vm.runInContext(
      [
        'BSONRegExp',
        'DBRef',
        'Decimal128',
        'Double',
        'Int32',
        'Long',
        'Int64',
        'MaxKey',
        'MinKey',
        'ObjectID',
        'ObjectId',
        'BSONSymbol',
        'Timestamp',
        'Code',
        'Buffer',
        'Binary',
      ]
        .map((name) => `function ${name}() {}`)
        .join('\n'),
      dummySandbox
    );
  }

  return vm.runInContext('(' + str + ')', dummySandbox, { timeout: 100 })
    .length;
};

enum TranspilerExportMode {
  PIPELINE = 'Pipeline',
  QUERY = 'Query',
  DELETE_QUERY = 'Delete Query',
  UPDATE_QUERY = 'Update Query',
}
const exportModeMapping: Record<
  ExportToLanguageMode,
  TranspilerExportMode | undefined
> = {
  [ExportToLanguageMode.AGGREGATION]: TranspilerExportMode.PIPELINE,
  [ExportToLanguageMode.QUERY]: TranspilerExportMode.QUERY,
  [ExportToLanguageMode.OTHER]: undefined,
};

/**
 * This controller manages playground.
 */
export default class PlaygroundController {
  _connectionController: ConnectionController;
  _activeTextEditor?: TextEditor;
  _playgroundResult?: PlaygroundResult;
  _languageServerController: LanguageServerController;
  _selectedText?: string;
  _exportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
  _playgroundSelectedCodeActionProvider: PlaygroundSelectedCodeActionProvider;
  _telemetryService: TelemetryService;

  _isPartialRun = false;

  private _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  private _playgroundResultViewColumn?: vscode.ViewColumn;
  private _playgroundResultTextDocument?: vscode.TextDocument;
  private _statusView: StatusView;
  private _playgroundResultViewProvider: PlaygroundResultProvider;
  private _participantController: ParticipantController;

  private _codeToEvaluate = '';

  constructor({
    connectionController,
    languageServerController,
    telemetryService,
    statusView,
    playgroundResultViewProvider,
    activeConnectionCodeLensProvider,
    exportToLanguageCodeLensProvider,
    playgroundSelectedCodeActionProvider,
    participantController,
  }: {
    connectionController: ConnectionController;
    languageServerController: LanguageServerController;
    telemetryService: TelemetryService;
    statusView: StatusView;
    playgroundResultViewProvider: PlaygroundResultProvider;
    activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
    exportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
    playgroundSelectedCodeActionProvider: PlaygroundSelectedCodeActionProvider;
    participantController: ParticipantController;
  }) {
    this._connectionController = connectionController;
    this._activeTextEditor = vscode.window.activeTextEditor;
    this._languageServerController = languageServerController;
    this._telemetryService = telemetryService;
    this._statusView = statusView;
    this._playgroundResultViewProvider = playgroundResultViewProvider;
    this._activeConnectionCodeLensProvider = activeConnectionCodeLensProvider;
    this._exportToLanguageCodeLensProvider = exportToLanguageCodeLensProvider;
    this._playgroundSelectedCodeActionProvider =
      playgroundSelectedCodeActionProvider;
    this._participantController = participantController;

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
        this._playgroundSelectedCodeActionProvider.setActiveTextEditor(
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

    vscode.window.onDidChangeTextEditorSelection(
      async (changeEvent: vscode.TextEditorSelectionChangeEvent) => {
        if (!isPlayground(changeEvent?.textEditor?.document?.uri)) {
          return;
        }

        // Sort lines selected as the may be mis-ordered from alt+click.
        const sortedSelections = (
          changeEvent.selections as Array<vscode.Selection>
        ).sort((a, b) => (a.start.line > b.start.line ? 1 : -1));

        const selectedText = sortedSelections
          .map((item) => this._getSelectedText(item))
          .join('\n');

        if (selectedText === this._selectedText) {
          return;
        }

        this._selectedText = selectedText;

        const mode =
          await this._languageServerController.getExportToLanguageMode({
            textFromEditor: this._getAllText(),
            selection: sortedSelections[0],
          });

        this._playgroundSelectedCodeActionProvider.refresh({
          selection: sortedSelections[0],
          mode,
        });
      }
    );
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

  createPlaygroundFromParticipantQuery({
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
    this._telemetryService.trackPlaygroundCreated('agent');
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

      this._exportToLanguageCodeLensProvider.refresh({
        ...this._exportToLanguageCodeLensProvider._exportToLanguageAddons,
        language,
      });
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

  changeExportToLanguageAddons(
    exportToLanguageAddons: ExportToLanguageAddons
  ): Promise<boolean> {
    this._exportToLanguageCodeLensProvider.refresh(exportToLanguageAddons);

    return this._transpile();
  }

  async exportToLanguage(language: string): Promise<boolean> {
    this._exportToLanguageCodeLensProvider.refresh({
      ...this._exportToLanguageCodeLensProvider._exportToLanguageAddons,
      textFromEditor: this._getAllText(),
      selectedText: this._selectedText,
      selection: this._playgroundSelectedCodeActionProvider.selection,
      language,
      mode: this._playgroundSelectedCodeActionProvider.mode,
    });

    return this._transpile();
  }

  async getTranspiledContent(): Promise<
    { namespace: ExportToLanguageNamespace; expression: string } | undefined
  > {
    const {
      textFromEditor,
      selectedText,
      selection,
      driverSyntax,
      builders,
      language,
    } = this._exportToLanguageCodeLensProvider._exportToLanguageAddons;
    let namespace: ExportToLanguageNamespace = {
      databaseName: 'DATABASE_NAME',
      collectionName: 'COLLECTION_NAME',
    };
    let expression = '';

    if (!textFromEditor || !selection) {
      return;
    }

    if (driverSyntax) {
      const connectionId = this._connectionController.getActiveConnectionId();
      let driverUrl = 'mongodb://localhost:27017';

      if (connectionId) {
        namespace =
          await this._languageServerController.getNamespaceForSelection({
            textFromEditor,
            selection,
          });

        const mongoClientOptions =
          this._connectionController.getMongoClientConnectionOptions();
        driverUrl = mongoClientOptions?.url || '';
      }

      const toCompile: ToCompile = {
        options: {
          collection: namespace.collectionName,
          database: namespace.databaseName,
          uri: driverUrl,
        },
      };

      if (
        this._playgroundSelectedCodeActionProvider.mode ===
        ExportToLanguageMode.AGGREGATION
      ) {
        toCompile.aggregation = selectedText;
      } else if (
        this._playgroundSelectedCodeActionProvider.mode ===
        ExportToLanguageMode.QUERY
      ) {
        toCompile.filter = selectedText;
      }

      expression = transpiler.shell[language].compileWithDriver(
        toCompile,
        builders
      );
    } else {
      expression = transpiler.shell[language].compile(
        selectedText,
        builders,
        false
      );
    }

    return { namespace, expression };
  }

  async evaluateParticipantQuery({ text }: { text: string }): Promise<boolean> {
    this._codeToEvaluate = text;
    return this._evaluatePlayground();
  }

  async _transpile(): Promise<boolean> {
    const { selectedText, importStatements, driverSyntax, builders, language } =
      this._exportToLanguageCodeLensProvider._exportToLanguageAddons;

    log.info(`Exporting to the '${language}' language...`);

    try {
      const transpiledContent = await this.getTranspiledContent();

      if (!transpiledContent) {
        void vscode.window.showInformationMessage(
          'Please select one or more lines in the playground.'
        );
        return true;
      }

      const { namespace, expression } = transpiledContent;

      let imports = '';

      if (importStatements) {
        const exportMode = this._playgroundSelectedCodeActionProvider.mode
          ? exportModeMapping[this._playgroundSelectedCodeActionProvider.mode]
          : undefined;
        imports = transpiler.shell[language].getImports(
          exportMode,
          driverSyntax
        );
      }

      this._playgroundResult = {
        namespace:
          namespace.databaseName && namespace.collectionName
            ? `${namespace.databaseName}.${namespace.collectionName}`
            : null,
        type: null,
        content: imports ? `${imports}\n\n${expression}` : expression,
        language,
      };

      log.info(
        `Exported to the '${language}' language`,
        this._playgroundResult
      );

      /* eslint-disable camelcase */
      if (
        this._playgroundSelectedCodeActionProvider.mode ===
        ExportToLanguageMode.AGGREGATION
      ) {
        const aggExportedProps = {
          language,
          num_stages: selectedText
            ? countAggregationStagesInString(selectedText)
            : null,
          with_import_statements: importStatements,
          with_builders: builders,
          with_driver_syntax: driverSyntax,
        };

        this._telemetryService.trackAggregationExported(aggExportedProps);
      } else if (
        this._playgroundSelectedCodeActionProvider.mode ===
        ExportToLanguageMode.QUERY
      ) {
        const queryExportedProps = {
          language,
          with_import_statements: importStatements,
          with_builders: builders,
          with_driver_syntax: driverSyntax,
        };

        this._telemetryService.trackQueryExported(queryExportedProps);
      }
      /* eslint-enable camelcase */

      await this._openPlaygroundResult();
    } catch (error) {
      log.error(`Export to the '${language}' language failed`, error);
      const printableError = formatError(error);
      void vscode.window.showErrorMessage(
        `Unable to export to ${language} language: ${printableError.message}`
      );
    }

    return true;
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
