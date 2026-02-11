import * as vscode from 'vscode';
import { EJSON, type Document } from 'bson';
import path from 'path';
import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import {
  PreviewMessageType,
  SORT_VALUE_MAP,
  type DocumentSort,
  type SortValueKey,
} from './data-browsing-app/extension-app-message-constants';
import type { TelemetryService } from '../telemetry';
import { createWebviewPanel, getWebviewHtml } from '../utils/webviewHelpers';
import type { MessageFromWebviewToExtension } from './data-browsing-app/extension-app-message-constants';
import { CollectionType } from '../explorer/documentUtils';
import formatError from '../utils/formatError';
import {
  getThemeTokenColors,
  getMonacoBaseTheme,
} from '../utils/themeColorReader';

const log = createLogger('data browsing controller');

const DEFAULT_DOCUMENTS_LIMIT = 10;

const getCodiconsDistPath = (extensionPath: string): string => {
  return path.join(extensionPath, 'dist', 'codicons');
};

const getMonacoEditorDistPath = (extensionPath: string): string => {
  return path.join(extensionPath, 'dist', 'monaco-editor');
};

export function getDefaultSortOrder(): SortValueKey {
  return (
    vscode.workspace
      .getConfiguration('mdb')
      .get<SortValueKey>('defaultSortOrder') ?? 'default'
  );
}

function getDefaultDocumentSort(): DocumentSort | undefined {
  return SORT_VALUE_MAP[getDefaultSortOrder()];
}

export const getDataBrowsingContent = ({
  extensionPath,
  webview,
  namespace,
}: {
  extensionPath: string;
  webview: vscode.Webview;
  namespace: string;
}): string => {
  const codiconsDistPath = getCodiconsDistPath(extensionPath);
  const codiconStylesheetUri = webview
    .asWebviewUri(vscode.Uri.file(path.join(codiconsDistPath, 'codicon.css')))
    .toString();

  const monacoEditorDistPath = getMonacoEditorDistPath(extensionPath);
  const monacoEditorBaseUri = webview
    .asWebviewUri(vscode.Uri.file(monacoEditorDistPath))
    .toString();

  const additionalHeadContent = `
    <link id="vscode-codicon-stylesheet" rel="stylesheet" href="${codiconStylesheetUri}" nonce="\${nonce}">
    <script nonce="\${nonce}">window.MONACO_EDITOR_BASE_URI = '${monacoEditorBaseUri}';</script>`;

  return getWebviewHtml({
    extensionPath,
    webview,
    webviewType: 'dataBrowser',
    title: namespace,
    additionalHeadContent,
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
  _telemetryService: TelemetryService;
  _activeWebviewPanels: vscode.WebviewPanel[] = [];
  _configChangedSubscription: vscode.Disposable;

  _panelAbortControllers: Map<vscode.WebviewPanel, PanelAbortControllers> =
    new Map();

  constructor({
    connectionController,
    telemetryService,
  }: {
    connectionController: ConnectionController;
    telemetryService: TelemetryService;
  }) {
    this._connectionController = connectionController;
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
          message.sort,
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
    sort?: DocumentSort,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel, 'documents');
    const { signal } = abortController;

    // When no explicit sort is provided by the webview, apply the
    // user's configured default sort order from extension settings.
    const effectiveSort = sort ?? getDefaultDocumentSort();

    try {
      const documents = await this._fetchDocuments(
        options.namespace,
        signal,
        skip,
        limit,
        effectiveSort,
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

  private async _fetchDocuments(
    namespace: string,
    signal?: AbortSignal,
    skip?: number,
    limit?: number,
    sort?: DocumentSort,
  ): Promise<Document[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      throw new Error('No active database connection');
    }

    const findOptions: {
      limit: number;
      skip?: number;
      sort?: DocumentSort;
      promoteValues: false;
    } = {
      limit: limit ?? DEFAULT_DOCUMENTS_LIMIT,
      promoteValues: false,
    };

    if (skip !== undefined && skip > 0) {
      findOptions.skip = skip;
    }

    if (sort) {
      findOptions.sort = sort;
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

    panel.onDidDispose(() => this.onWebviewPanelClosed(panel));
    this._activeWebviewPanels.push(panel);

    panel.webview.html = getDataBrowsingContent({
      extensionPath,
      webview: panel.webview,
      namespace: options.namespace,
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
