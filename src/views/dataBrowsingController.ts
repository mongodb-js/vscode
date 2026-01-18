import type * as vscode from 'vscode';
import type { Document } from 'bson';

import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import {
  PreviewMessageType,
  type SortOption,
} from './data-browsing-app/extension-app-message-constants';
import type { TelemetryService } from '../telemetry';
import { createWebviewPanel, getWebviewHtml } from '../utils/webviewHelpers';
import type { MessageFromWebviewToExtension } from './data-browsing-app/extension-app-message-constants';
import { CollectionType } from '../explorer/documentUtils';
import formatError from '../utils/formatError';

const log = createLogger('data browsing controller');

const DEFAULT_DOCUMENTS_LIMIT = 10;

export const getDataBrowsingContent = ({
  extensionPath,
  webview,
  namespace,
}: {
  extensionPath: string;
  webview: vscode.Webview;
  namespace: string;
}): string => {
  return getWebviewHtml({
    extensionPath,
    webview,
    webviewType: 'dataBrowser',
    title: namespace,
  });
};

export interface DataBrowsingOptions {
  namespace: string;
  collectionType: string;
}

export default class DataBrowsingController {
  _connectionController: ConnectionController;
  _telemetryService: TelemetryService;
  _activeWebviewPanels: vscode.WebviewPanel[] = [];

  _panelAbortControllers: Map<vscode.WebviewPanel, AbortController> = new Map();

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
    for (const abortController of this._panelAbortControllers.values()) {
      abortController.abort();
    }
    this._panelAbortControllers.clear();
  }

  /**
   * Creates a new AbortController for a panel, aborting any previous one.
   * This ensures only one request is in-flight per panel at a time.
   */
  private _createAbortController(panel: vscode.WebviewPanel): AbortController {
    const existingController = this._panelAbortControllers.get(panel);
    if (existingController) {
      existingController.abort();
    }

    const abortController = new AbortController();
    this._panelAbortControllers.set(panel, abortController);
    return abortController;
  }

  /**
   * Cleans up the abort controller for a panel.
   */
  private _cleanupAbortController(panel: vscode.WebviewPanel): void {
    const controller = this._panelAbortControllers.get(panel);
    if (controller) {
      controller.abort();
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
        await this.handleGetDocuments(panel, options);
        return;
      case PreviewMessageType.refreshDocuments:
        await this.handleRefreshDocuments(panel, options);
        return;
      case PreviewMessageType.sortDocuments:
        await this.handleSortDocuments(panel, options, message.sortOption);
        return;
      default:
        // no-op.
        return;
    }
  };

  handleGetDocuments = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel);
    const { signal } = abortController;

    try {
      const documents = await this._fetchDocuments(
        options.namespace,
        options.collectionType,
        signal,
      );

      // Check if aborted before posting message.
      if (signal.aborted) {
        return;
      }

      void panel.webview.postMessage({
        command: PreviewMessageType.loadDocuments,
        documents,
      });
    } catch (error) {
      // Don't report errors for aborted requests.
      if (signal.aborted) {
        return;
      }
      log.error('Error getting documents', error);
      void panel.webview.postMessage({
        command: PreviewMessageType.refreshError,
        error: formatError(error).message,
      });
    }
  };

  handleRefreshDocuments = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel);
    const { signal } = abortController;

    try {
      const documents = await this._fetchDocuments(
        options.namespace,
        options.collectionType,
        signal,
      );

      // Check if aborted before posting message.
      if (signal.aborted) {
        return;
      }

      void panel.webview.postMessage({
        command: PreviewMessageType.loadDocuments,
        documents,
      });
    } catch (error) {
      // Don't report errors for aborted requests.
      if (signal.aborted) {
        return;
      }
      log.error('Error refreshing documents', error);
      void panel.webview.postMessage({
        command: PreviewMessageType.refreshError,
        error: formatError(error).message,
      });
    }
  };

  handleSortDocuments = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
    sortOption: SortOption,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel);
    const { signal } = abortController;

    try {
      const documents = await this._fetchDocuments(
        options.namespace,
        options.collectionType,
        signal,
        sortOption,
      );

      // Check if aborted before posting message.
      if (signal.aborted) {
        return;
      }

      void panel.webview.postMessage({
        command: PreviewMessageType.loadDocuments,
        documents,
      });
    } catch (error) {
      // Don't report errors for aborted requests.
      if (signal.aborted) {
        return;
      }
      log.error('Error sorting documents', error);
      void panel.webview.postMessage({
        command: PreviewMessageType.refreshError,
        error: formatError(error).message,
      });
    }
  };

  private async _fetchDocuments(
    namespace: string,
    collectionType: string,
    signal?: AbortSignal,
    sortOption?: SortOption,
  ): Promise<Document[]> {
    if (collectionType === CollectionType.view) {
      return [];
    }

    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return [];
    }

    // Build sort object based on sortOption
    let sort: { _id: 1 | -1 } | undefined;
    if (sortOption === 'asc') {
      sort = { _id: 1 };
    } else if (sortOption === 'desc') {
      sort = { _id: -1 };
    }

    const findOptions: { limit: number; sort?: { _id: 1 | -1 } } = {
      limit: DEFAULT_DOCUMENTS_LIMIT,
    };

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
}
