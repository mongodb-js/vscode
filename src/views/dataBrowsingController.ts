import * as vscode from 'vscode';
import { EJSON, type Document } from 'bson';
import path from 'path';
import { toJSString } from 'mongodb-query-parser';
import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { PreviewMessageType } from './data-browsing-app/extension-app-message-constants';
import type { TelemetryService } from '../telemetry';
import { createWebviewPanel, getWebviewHtml } from '../utils/webviewHelpers';
import type { MessageFromWebviewToExtension } from './data-browsing-app/extension-app-message-constants';
import { CollectionType } from '../explorer/documentUtils';
import formatError from '../utils/formatError';
import {
  getThemeTokenColors,
  getMonacoBaseTheme,
} from '../utils/themeColorReader';
import type EditorsController from '../editors/editorsController';
import type PlaygroundController from '../editors/playgroundController';
import { DocumentSource } from '../documentSource';
import { getDocumentViewAndEditFormat } from '../editors/types';
import type ExplorerController from '../explorer/explorerController';

const log = createLogger('data browsing controller');

const DEFAULT_DOCUMENTS_LIMIT = 10;

const getCodiconsDistPath = (extensionPath: string): string => {
  return path.join(extensionPath, 'dist', 'codicons');
};

const getMonacoEditorDistPath = (extensionPath: string): string => {
  return path.join(extensionPath, 'dist', 'monaco-editor');
};

export const getDataBrowsingContent = ({
  extensionPath,
  webview,
  namespace,
  codiconStylesheetUri,
  monacoEditorBaseUri,
}: {
  extensionPath: string;
  webview: vscode.Webview;
  namespace: string;
  codiconStylesheetUri: string;
  monacoEditorBaseUri: string;
}): string => {
  return getWebviewHtml({
    extensionPath,
    webview,
    webviewType: 'dataBrowser',
    title: namespace,
    codiconStylesheetUri,
    monacoEditorBaseUri,
  });
};

export interface DataBrowsingOptions {
  namespace: string;
  collectionType: string;
}

type RequestType = 'documents' | 'totalCount';

interface PanelAbortControllers {
  documents?: AbortController;
  totalCount?: AbortController;
}

export default class DataBrowsingController {
  _connectionController: ConnectionController;
  _editorsController: EditorsController;
  _playgroundController: PlaygroundController;
  _explorerController: ExplorerController;
  _telemetryService: TelemetryService;
  _activeWebviewPanels: vscode.WebviewPanel[] = [];
  _configChangedSubscription: vscode.Disposable;

  _panelAbortControllers: Map<vscode.WebviewPanel, PanelAbortControllers> =
    new Map();

  constructor({
    connectionController,
    editorsController,
    playgroundController,
    explorerController,
    telemetryService,
  }: {
    connectionController: ConnectionController;
    editorsController: EditorsController;
    playgroundController: PlaygroundController;
    explorerController: ExplorerController;
    telemetryService: TelemetryService;
  }) {
    this._connectionController = connectionController;
    this._editorsController = editorsController;
    this._playgroundController = playgroundController;
    this._explorerController = explorerController;
    this._telemetryService = telemetryService;
    this._configChangedSubscription = vscode.workspace.onDidChangeConfiguration(
      this.onConfigurationChanged,
    );
  }

  deactivate(): void {
    this._configChangedSubscription?.dispose();
    for (const controllers of this._panelAbortControllers.values()) {
      controllers.documents?.abort();
      controllers.totalCount?.abort();
    }
    this._panelAbortControllers.clear();
  }

  private _createAbortController(
    panel: vscode.WebviewPanel,
    requestType: RequestType,
  ): AbortController {
    let controllers = this._panelAbortControllers.get(panel);
    if (!controllers) {
      controllers = {};
      this._panelAbortControllers.set(panel, controllers);
    }

    controllers[requestType]?.abort();

    const abortController = new AbortController();
    controllers[requestType] = abortController;
    return abortController;
  }

  private _cleanupAbortController(panel: vscode.WebviewPanel): void {
    const controllers = this._panelAbortControllers.get(panel);
    if (controllers) {
      controllers.documents?.abort();
      controllers.totalCount?.abort();
      this._panelAbortControllers.delete(panel);
    }
  }

  handleWebviewMessage = async (
    message: MessageFromWebviewToExtension,
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    switch (message.command) {
      case PreviewMessageType.getDocuments:
        await this.handleGetDocuments(
          panel,
          options,
          message.skip,
          message.limit,
        );
        return;
      case PreviewMessageType.getTotalCount:
        await this.handleGetTotalCount(panel, options);
        return;
      case PreviewMessageType.cancelRequest:
        this.handleCancelRequest(panel);
        return;
      case PreviewMessageType.getThemeColors:
        this._sendThemeColors(panel);
        return;
      case PreviewMessageType.editDocument:
        await this.handleEditDocument(
          options,
          EJSON.deserialize(message.documentId, { relaxed: false }),
        );
        return;
      case PreviewMessageType.cloneDocument:
        await this.handleCloneDocument(options, message.document);
        return;
      case PreviewMessageType.deleteDocument:
        await this.handleDeleteDocument(
          panel,
          options,
          EJSON.deserialize(message.documentId, { relaxed: false }),
        );
        return;
      default:
        // no-op.
        return;
    }
  };

  handleCancelRequest = (panel: vscode.WebviewPanel): void => {
    const controllers = this._panelAbortControllers.get(panel);
    if (controllers) {
      controllers.documents?.abort();
      controllers.totalCount?.abort();
      this._panelAbortControllers.delete(panel);
    }

    void panel.webview.postMessage({
      command: PreviewMessageType.requestCancelled,
    });
  };

  handleGetDocuments = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
    skip: number,
    limit: number,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel, 'documents');
    const { signal } = abortController;

    this._sendThemeColors(panel);

    try {
      const documents = await this._fetchDocuments(
        options.namespace,
        signal,
        skip,
        limit,
      );

      if (signal.aborted) {
        return;
      }

      void panel.webview.postMessage({
        command: PreviewMessageType.loadPage,
        documents: EJSON.serialize(documents, { relaxed: false }),
      });
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      log.error('Error refreshing documents', error);
      void panel.webview.postMessage({
        command: PreviewMessageType.getDocumentError,
        error: formatError(error).message,
      });
    }
  };

  handleGetTotalCount = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel, 'totalCount');
    const { signal } = abortController;

    try {
      const totalCount = await this._getTotalCount(
        options.namespace,
        options.collectionType,
        signal,
      );

      if (signal.aborted) {
        return;
      }

      void panel.webview.postMessage({
        command: PreviewMessageType.updateTotalCount,
        totalCount,
      });
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      log.error('Error fetching total count', error);
      void panel.webview.postMessage({
        command: PreviewMessageType.updateTotalCountError,
        error: formatError(error).message,
      });
    }
  };

  handleEditDocument = async (
    options: DataBrowsingOptions,
    documentId: any,
  ): Promise<void> => {
    try {
      await this._editorsController.openMongoDBDocument({
        source: DocumentSource.databrowser,
        documentId,
        namespace: options.namespace,
        format: getDocumentViewAndEditFormat(),
        connectionId: this._connectionController.getActiveConnectionId(),
        line: 1,
      });
    } catch (error) {
      log.error('Error opening document for editing', error);
      void vscode.window.showErrorMessage(
        `Failed to open document: ${formatError(error).message}`,
      );
    }
  };

  handleCloneDocument = async (
    options: DataBrowsingOptions,
    document: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const deserialized = EJSON.deserialize(document, { relaxed: false });
      delete deserialized._id;
      const documentContents = toJSString(deserialized) ?? '';

      const [databaseName, collectionName] = options.namespace.split(/\.(.*)/s);

      await this._playgroundController.createPlaygroundForCloneDocument(
        documentContents,
        databaseName,
        collectionName,
      );
    } catch (error) {
      log.error('Error cloning document', error);
      void vscode.window.showErrorMessage(
        `Failed to clone document: ${formatError(error).message}`,
      );
    }
  };

  handleDeleteDocument = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
    documentId: any,
  ): Promise<void> => {
    try {
      const shouldConfirmDeleteDocument = vscode.workspace
        .getConfiguration('mdb')
        .get('confirmDeleteDocument');

      if (shouldConfirmDeleteDocument === true) {
        const documentIdString = JSON.stringify(
          EJSON.serialize(documentId, { relaxed: false }),
        );
        const confirmationResult = await vscode.window.showInformationMessage(
          `Are you sure you wish to drop this document${documentIdString ? ` ${documentIdString}` : ''}?`,
          {
            modal: true,
            detail:
              'This confirmation can be disabled in the extension settings.',
          },
          'Yes',
        );

        if (confirmationResult !== 'Yes') {
          return;
        }
      }

      const dataService = this._connectionController.getActiveDataService();
      if (!dataService) {
        throw new Error('No active database connection');
      }

      const deleteResult = await dataService.deleteOne(
        options.namespace,
        { _id: documentId },
        {},
      );

      if (deleteResult.deletedCount !== 1) {
        throw new Error('document not found');
      }

      void vscode.window.showInformationMessage(
        'Document successfully deleted.',
      );

      // Refresh the explorer view
      this._explorerController.refresh();

      // Notify the webview that the document was deleted
      void panel.webview.postMessage({
        command: PreviewMessageType.documentDeleted,
      });
    } catch (error) {
      log.error('Error deleting document', error);
      void vscode.window.showErrorMessage(
        `Failed to delete document: ${formatError(error).message}`,
      );
    }
  };

  private async _fetchDocuments(
    namespace: string,
    signal?: AbortSignal,
    skip?: number,
    limit?: number,
  ): Promise<Document[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      throw new Error('No active database connection');
    }

    const findOptions: { limit: number; skip?: number; promoteValues: false } =
      {
        limit: limit ?? DEFAULT_DOCUMENTS_LIMIT,
        promoteValues: false,
      };

    if (skip !== undefined && skip > 0) {
      findOptions.skip = skip;
    }

    const executionOptions = signal ? { abortSignal: signal } : undefined;

    return dataService.find(namespace, {}, findOptions, executionOptions);
  }

  onReceivedWebviewMessage = async (
    message: MessageFromWebviewToExtension,
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    try {
      await this.handleWebviewMessage(message, panel, options);
    } catch (err) {
      log.error('Error occurred when parsing message from webview', err);
      return;
    }
  };

  onWebviewPanelClosed = (disposedPanel: vscode.WebviewPanel): void => {
    this._cleanupAbortController(disposedPanel);

    this._activeWebviewPanels = this._activeWebviewPanels.filter(
      (panel) => panel !== disposedPanel,
    );
  };

  onConfigurationChanged = (event: vscode.ConfigurationChangeEvent): void => {
    if (event.affectsConfiguration('workbench.colorTheme')) {
      for (const panel of this._activeWebviewPanels) {
        this._sendThemeColors(panel);
      }
    }
  };

  private async _getTotalCount(
    namespace: string,
    collectionType: string,
    signal: AbortSignal,
  ): Promise<number | null> {
    if (
      collectionType === CollectionType.view ||
      collectionType === CollectionType.timeseries
    ) {
      return null;
    }

    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      throw new Error('No active database connection');
    }

    const stages = [{ $count: 'count' }];
    const executionOptions = signal ? { abortSignal: signal } : undefined;

    const result = await dataService.aggregate(
      namespace,
      stages,
      {},
      executionOptions,
    );

    return result.length ? result[0].count : 0;
  }

  openDataBrowser(
    context: vscode.ExtensionContext,
    options: DataBrowsingOptions,
  ): vscode.WebviewPanel {
    log.info('Opening data browser...', options.namespace);
    const extensionPath = context.extensionPath;

    const panel = createWebviewPanel({
      viewType: 'mongodbDataBrowser',
      title: options.namespace,
      extensionPath,
      iconName: 'leaf.svg',
    });

    // Generate the codicon stylesheet URI for the webview
    // Codicons are copied to dist/codicons during webpack build
    const codiconsDistPath = getCodiconsDistPath(extensionPath);
    const codiconCssUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(codiconsDistPath, 'codicon.css')),
    );
    const codiconStylesheetUri = codiconCssUri.toString();

    // Generate the Monaco Editor base URI for the webview
    // Monaco Editor files are copied to dist/monaco-editor during webpack build
    const monacoEditorDistPath = getMonacoEditorDistPath(extensionPath);
    const monacoEditorBaseUriObj = panel.webview.asWebviewUri(
      vscode.Uri.file(monacoEditorDistPath),
    );
    const monacoEditorBaseUri = monacoEditorBaseUriObj.toString();

    panel.onDidDispose(() => this.onWebviewPanelClosed(panel));
    this._activeWebviewPanels.push(panel);

    panel.webview.html = getDataBrowsingContent({
      extensionPath,
      webview: panel.webview,
      namespace: options.namespace,
      codiconStylesheetUri,
      monacoEditorBaseUri,
    });

    panel.webview.onDidReceiveMessage(
      (message: MessageFromWebviewToExtension) =>
        this.onReceivedWebviewMessage(message, panel, options),
      undefined,
      context.subscriptions,
    );

    return panel;
  }

  private _sendThemeColors(panel: vscode.WebviewPanel): void {
    const themeColors = getThemeTokenColors();
    const themeKind = getMonacoBaseTheme();
    void panel.webview.postMessage({
      command: PreviewMessageType.updateThemeColors,
      themeColors,
      themeKind,
    });
  }
}
