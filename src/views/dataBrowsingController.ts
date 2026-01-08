import * as vscode from 'vscode';
import type { Document } from 'bson';

import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import {
  PreviewMessageType,
  type SortOption,
} from './data-browsing-app/extension-app-message-constants';
import type { TelemetryService } from '../telemetry';
import { createWebviewPanel, getWebviewHtml } from '../utils/webviewHelpers';
import formatError from '../utils/formatError';
import { MessageFromWebviewToExtension } from './data-browsing-app/extension-app-message-constants';

const log = createLogger('data browsing controller');

export const getDataBrowsingContent = ({
  extensionPath,
  webview,
}: {
  extensionPath: string;
  webview: vscode.Webview;
}): string => {
  return getWebviewHtml({
    extensionPath,
    webview,
    webviewType: 'dataBrowser',
    title: 'MongoDB Data Browser',
  });
};

export interface DataBrowsingOptions {
  namespace: string;
  documents: Document[];
  fetchDocuments?: (options?: {
    sort?: SortOption;
    limit?: number;
    signal?: AbortSignal;
  }) => Promise<Document[]>;
  initialTotalCount?: number;
  getTotalCount?: (signal?: AbortSignal) => Promise<number>;
}

export default class DataBrowsingController {
  _connectionController: ConnectionController;
  _telemetryService: TelemetryService;
  _activeWebviewPanels: vscode.WebviewPanel[] = [];
  _themeChangedSubscription: vscode.Disposable;

  // Track active abort controllers per panel for cancelling in-flight requests.
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
    this._themeChangedSubscription = vscode.window.onDidChangeActiveColorTheme(
      this.onThemeChanged,
    );
  }

  deactivate(): void {
    this._themeChangedSubscription?.dispose();
    // Abort all in-flight requests on deactivation.
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
    // Abort any existing in-flight request for this panel.
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
        await this.handleSortDocuments(panel, options, message.sort);
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
      const totalCount = options.getTotalCount
        ? await options.getTotalCount(signal)
        : options.initialTotalCount;

      // Check if aborted before posting message.
      if (signal.aborted) {
        return;
      }

      void panel.webview.postMessage({
        command: PreviewMessageType.loadDocuments,
        documents: options.documents,
        totalCount,
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
      if (options.fetchDocuments) {
        const documents = await options.fetchDocuments({ signal });

        // Check if aborted before continuing.
        if (signal.aborted) {
          return;
        }

        const totalCount = options.getTotalCount
          ? await options.getTotalCount(signal)
          : options.initialTotalCount;

        // Check if aborted before posting message.
        if (signal.aborted) {
          return;
        }

        void panel.webview.postMessage({
          command: PreviewMessageType.loadDocuments,
          documents,
          totalCount,
        });
      } else {
        void panel.webview.postMessage({
          command: PreviewMessageType.loadDocuments,
          documents: options.documents,
          totalCount: options.initialTotalCount,
        });
      }
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
    sort: SortOption,
  ): Promise<void> => {
    const abortController = this._createAbortController(panel);
    const { signal } = abortController;

    try {
      if (options.fetchDocuments) {
        const documents = await options.fetchDocuments({ sort, signal });

        // Check if aborted before continuing.
        if (signal.aborted) {
          return;
        }

        const totalCount = options.getTotalCount
          ? await options.getTotalCount(signal)
          : options.initialTotalCount;

        // Check if aborted before posting message.
        if (signal.aborted) {
          return;
        }

        void panel.webview.postMessage({
          command: PreviewMessageType.loadDocuments,
          documents,
          totalCount,
        });
      }
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

  onReceivedWebviewMessage = async (
    message: MessageFromWebviewToExtension,
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    // Ensure handling message from the webview can't crash the extension.
    try {
      await this.handleWebviewMessage(message, panel, options);
    } catch (err) {
      log.error('Error occurred when parsing message from webview', err);
      return;
    }
  };

  onWebviewPanelClosed = (disposedPanel: vscode.WebviewPanel): void => {
    // Abort any in-flight requests for this panel.
    this._cleanupAbortController(disposedPanel);

    this._activeWebviewPanels = this._activeWebviewPanels.filter(
      (panel) => panel !== disposedPanel,
    );
  };

  onThemeChanged = (theme: vscode.ColorTheme): void => {
    const darkModeDetected =
      theme.kind === vscode.ColorThemeKind.Dark ||
      theme.kind === vscode.ColorThemeKind.HighContrast;
    for (const panel of this._activeWebviewPanels) {
      void panel.webview
        .postMessage({
          command: PreviewMessageType.themeChanged,
          darkMode: darkModeDetected,
        })
        .then(undefined, (error) => {
          log.warn(
            'Could not post THEME_CHANGED to webview, most likely already disposed',
            error,
          );
        });
    }
  };

  openDataBrowser(
    context: vscode.ExtensionContext,
    options: DataBrowsingOptions,
  ): vscode.WebviewPanel {
    log.info('Opening data browser...', options.namespace);
    const extensionPath = context.extensionPath;

    // Create and show a new data browsing webview.
    const panel = createWebviewPanel({
      viewType: 'mongodbDataBrowser',
      title: `Preview: ${options.namespace}`,
      extensionPath,
      iconName: 'leaf.svg',
    });

    panel.onDidDispose(() => this.onWebviewPanelClosed(panel));
    this._activeWebviewPanels.push(panel);

    panel.webview.html = getDataBrowsingContent({
      extensionPath,
      webview: panel.webview,
    });

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: MessageFromWebviewToExtension) =>
        this.onReceivedWebviewMessage(message, panel, options),
      undefined,
      context.subscriptions,
    );

    return panel;
  }
}
