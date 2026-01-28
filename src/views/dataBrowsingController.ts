import * as vscode from 'vscode';
import type { Document } from 'bson';
import path from 'path';

import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { PreviewMessageType } from './data-browsing-app/extension-app-message-constants';
import type { TelemetryService } from '../telemetry';
import { createWebviewPanel, getWebviewHtml } from '../utils/webviewHelpers';
import type { MessageFromWebviewToExtension } from './data-browsing-app/extension-app-message-constants';
import { CollectionType } from '../explorer/documentUtils';
import formatError from '../utils/formatError';

const log = createLogger('data browsing controller');

const DEFAULT_DOCUMENTS_LIMIT = 10;

const getCodiconsDistPath = (extensionPath: string): string => {
  return path.join(extensionPath, 'dist', 'codicons');
};

export const getDataBrowsingContent = ({
  extensionPath,
  webview,
  namespace,
  codiconStylesheetUri,
}: {
  extensionPath: string;
  webview: vscode.Webview;
  namespace: string;
  codiconStylesheetUri: string;
}): string => {
  return getWebviewHtml({
    extensionPath,
    webview,
    webviewType: 'dataBrowser',
    title: namespace,
    codiconStylesheetUri,
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
  }

  deactivate(): void {
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
        documents,
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
  ): Promise<Document[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      throw new Error('No active database connection');
    }

    const findOptions: { limit: number; skip?: number } = {
      limit: limit ?? DEFAULT_DOCUMENTS_LIMIT,
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

    panel.onDidDispose(() => this.onWebviewPanelClosed(panel));
    this._activeWebviewPanels.push(panel);

    panel.webview.html = getDataBrowsingContent({
      extensionPath,
      webview: panel.webview,
      namespace: options.namespace,
      codiconStylesheetUri,
    });

    panel.webview.onDidReceiveMessage(
      (message: MessageFromWebviewToExtension) =>
        this.onReceivedWebviewMessage(message, panel, options),
      undefined,
      context.subscriptions,
    );

    return panel;
  }
}
