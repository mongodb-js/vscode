import * as vscode from 'vscode';
import { EJSON, type Document } from 'bson';
import path from 'path';
import { toJSString } from 'mongodb-query-parser';
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
import { getDocumentViewAndEditFormat } from '../editors/types';
import ExtensionCommand from '../commands';
import {
  CursorConstructionOptionsWithChains,
  CursorChainOptions,
} from '@mongosh/shell-api';
import type { AggregateOptions, DbOptions, FindOptions } from 'mongodb';
import { EventEmitter } from 'events';
import { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';

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

type FindQuery = {
  filter: Document;
  findOptions: FindOptions & EventEmitter.Abortable;
  dbOptions: DbOptions;
};

type AggregateQuery = {
  pipeline: Document[];
  aggregateOptions: AggregateOptions & EventEmitter.Abortable;
  dbOptions: DbOptions;
};

export type ParsedQuery = {
  limit: number | null;
  skip: number | null;
  chains: CursorChainOptions[];
} & (
  | {
      find: FindQuery;
    }
  | {
      aggregate: AggregateQuery;
    }
);

export function parseConstructionOptionsForFind(
  query: CursorConstructionOptionsWithChains & { options: { method: 'find' } },
): ParsedQuery {
  let limit: number | null = null;
  let skip: number | null = null;

  const [, , filter, findOptions, dbOptions] = query.options.args;
  if (findOptions) {
    if (findOptions.limit) {
      limit = findOptions.limit;
      delete findOptions.limit;
    }
    if (findOptions.skip) {
      skip = findOptions.skip;
      delete findOptions.skip;
    }
  }

  if (query.chains) {
    for (const chain of query.chains) {
      if (chain.method === 'limit') {
        limit = chain.args[0];
      } else if (chain.method === 'skip') {
        skip = chain.args[0];
      }
    }
  }

  const filteredChains = (query.chains ?? []).filter(
    (chain) => !['limit', 'skip'].includes(chain.method),
  );

  return {
    limit,
    skip,
    find: {
      filter: filter ?? {},
      findOptions: findOptions ?? {},
      dbOptions: dbOptions ?? {},
    },
    chains: filteredChains,
  };
}

export function parseConstructionOptionsForAggregate(
  query: CursorConstructionOptionsWithChains & {
    options: { method: 'aggregate' };
  },
): ParsedQuery {
  const [, , pipeline, aggregateOptions, dbOptions] = query.options.args;

  return {
    // Aggregation pipelines can have multiple limit or skip stages, so we don't
    // try to parse them out. Our code can safely append more.
    limit: null,
    skip: null,
    aggregate: {
      pipeline,
      aggregateOptions: aggregateOptions ?? {},
      dbOptions: dbOptions ?? {},
    },
    chains: query.chains ?? [],
  };
}

function getWebViewTitle(
  databaseName: string,
  collectionName: string,
  hasQuery: boolean,
): string {
  const namespace = `${databaseName}.${collectionName}`;
  return hasQuery ? `Playground Result: ${namespace}` : namespace;
}

export function parseConstructionOptions(
  query?: CursorConstructionOptionsWithChains,
): ParsedQuery {
  if (query) {
    if (isFindQuery(query)) {
      return parseConstructionOptionsForFind(query);
    }
    if (isAggregateQuery(query)) {
      return parseConstructionOptionsForAggregate(query);
    }

    throw new Error(
      'Only find and aggregate queries are supported in data browsing for now',
    );
  }
  return {
    limit: null,
    skip: null,
    find: {
      filter: {},
      findOptions: {},
      dbOptions: {},
    },
    chains: [],
  };
}

export const getDataBrowsingContent = ({
  extensionPath,
  webview,
  databaseName,
  collectionName,
  query,
}: {
  extensionPath: string;
  webview: vscode.Webview;
  databaseName: string;
  collectionName: string;
  query?: string;
}): string => {
  const codiconsDistPath = getCodiconsDistPath(extensionPath);
  const codiconStylesheetUri = webview
    .asWebviewUri(vscode.Uri.file(path.join(codiconsDistPath, 'codicon.css')))
    .toString();

  const monacoEditorDistPath = getMonacoEditorDistPath(extensionPath);
  const monacoEditorBaseUri = webview
    .asWebviewUri(vscode.Uri.file(monacoEditorDistPath))
    .toString();

  const defaultSortOrder = getDefaultSortOrder();

  const additionalHeadContent = `
    <link id="vscode-codicon-stylesheet" rel="stylesheet" href="${codiconStylesheetUri}" nonce="\${nonce}">
    <script nonce="\${nonce}">window.MDB_DATA_BROWSING_OPTIONS = ${JSON.stringify({ monacoEditorBaseUri, defaultSortOrder, query })};</script>`;

  return getWebviewHtml({
    extensionPath,
    webview,
    webviewType: 'dataBrowser',
    title: getWebViewTitle(databaseName, collectionName, !!query),
    additionalHeadContent,
  });
};

export interface DataBrowsingOptions {
  databaseName: string;
  collectionName: string;
  collectionType: string;
  query?: CursorConstructionOptionsWithChains;
}

type RequestType = 'documents' | 'totalCount';

interface PanelAbortControllers {
  documents?: AbortController;
  totalCount?: AbortController;
}

type FetchDocumentsParams = {
  databaseName: string;
  collectionName: string;
  signal: AbortSignal;
  skip: number;
  limit: number;
  sort?: DocumentSort;
  query?: CursorConstructionOptionsWithChains;
};

const isFindQuery = (
  query: CursorConstructionOptionsWithChains,
): query is CursorConstructionOptionsWithChains & {
  options: { method: 'find' };
} => {
  return query.options.method === 'find';
};

const isAggregateQuery = (
  query: CursorConstructionOptionsWithChains,
): query is CursorConstructionOptionsWithChains & {
  options: { method: 'aggregate' };
} => {
  return query.options.method === 'aggregate';
};

const isFindParsedQuery = (
  query: ParsedQuery,
): query is ParsedQuery & { find: FindQuery } => {
  return (query as any).find !== undefined;
};

const isAggregateParsedQuery = (
  query: ParsedQuery,
): query is ParsedQuery & { aggregate: AggregateQuery } => {
  return (query as any).aggregate !== undefined;
};

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
      case PreviewMessageType.deleteAllDocuments:
        await this.handleDeleteAllDocuments(panel, options);
        return;
      case PreviewMessageType.insertDocument:
        await this.handleInsertDocument(options);
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
      const documents = await this._fetchDocuments({
        databaseName: options.databaseName,
        collectionName: options.collectionName,
        query: options.query,
        signal,
        skip,
        limit,
        sort: effectiveSort,
      });

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
      const totalCount = await this._getTotalCount({
        databaseName: options.databaseName,
        collectionName: options.collectionName,
        collectionType: options.collectionType,
        query: options.query,
        signal,
      });

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
      await vscode.commands.executeCommand(
        ExtensionCommand.mdbOpenMongodbDocumentFromDataBrowser,
        {
          documentId,
          namespace: `${options.databaseName}.${options.collectionName}`,
          format: getDocumentViewAndEditFormat(),
          connectionId: this._connectionController.getActiveConnectionId(),
        },
      );
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

      await vscode.commands.executeCommand(
        ExtensionCommand.mdbCloneDocumentFromDataBrowser,
        {
          documentContents,
          databaseName: options.databaseName,
          collectionName: options.collectionName,
        },
      );
    } catch (error) {
      log.error('Error cloning document', error);
      void vscode.window.showErrorMessage(
        `Failed to clone document: ${formatError(error).message}`,
      );
    }
  };

  handleInsertDocument = async (
    options: DataBrowsingOptions,
  ): Promise<void> => {
    try {
      await vscode.commands.executeCommand(
        ExtensionCommand.mdbInsertDocumentFromDataBrowser,
        {
          databaseName: options.databaseName,
          collectionName: options.collectionName,
        },
      );
    } catch (error) {
      log.error('Error opening insert document playground', error);
      void vscode.window.showErrorMessage(
        `Failed to open insert document playground: ${formatError(error).message}`,
      );
    }
  };

  handleDeleteAllDocuments = async (
    panel: vscode.WebviewPanel,
    options: DataBrowsingOptions,
  ): Promise<void> => {
    if (options.query) {
      log.error('Delete all documents with a query is not supported');
      void vscode.window.showErrorMessage(
        `Delete all documents with a query is not supported.`,
      );
      return;
    }

    try {
      const confirmationResult = await vscode.window.showInformationMessage(
        `Are you sure you wish to delete all documents in ${options.databaseName}.${options.collectionName} collection?`,
        {
          modal: true,
          detail:
            'All documents present in this collection will be deleted. This action cannot be undone.',
        },
        'Yes',
      );

      if (confirmationResult !== 'Yes') {
        return;
      }

      const dataService = this._connectionController.getActiveDataService();
      if (!dataService) {
        throw new Error('No active database connection');
      }

      const namespace = `${options.databaseName}.${options.collectionName}`;

      const deleteResult = await dataService.deleteMany(namespace, {}, {});

      void vscode.window.showInformationMessage(
        `${deleteResult.deletedCount} document(s) successfully deleted.`,
      );

      // Refresh the tree view in the sidebar (reset collection cache so
      // the document count is re-fetched).
      await vscode.commands.executeCommand(
        ExtensionCommand.mdbRefreshCollectionFromDataBrowser,
        {
          databaseName: options.databaseName,
          collectionName: options.collectionName,
        },
      );

      // Notify the webview that documents were deleted so it refreshes
      void panel.webview.postMessage({
        command: PreviewMessageType.documentDeleted,
      });
    } catch (error) {
      log.error('Error deleting all documents', error);
      void vscode.window.showErrorMessage(
        `Failed to delete all documents: ${formatError(error).message}`,
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
        `${options.databaseName}.${options.collectionName}`,
        { _id: documentId },
        {},
      );

      if (deleteResult.deletedCount !== 1) {
        throw new Error('document not found');
      }

      void vscode.window.showInformationMessage(
        'Document successfully deleted.',
      );

      // Refresh the tree view in the sidebar (reset collection cache so
      // the document count is re-fetched).
      await vscode.commands.executeCommand(
        ExtensionCommand.mdbRefreshCollectionFromDataBrowser,
        {
          databaseName: options.databaseName,
          collectionName: options.collectionName,
        },
      );

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

  private async _fetchDocumentsForFind({
    databaseName,
    collectionName,
    limit,
    skip,
    sort,
    signal,
    parsedQuery,
  }: FetchDocumentsParams & {
    parsedQuery: ParsedQuery & { find: FindQuery };
  }): Promise<Document[]> {
    const connectionOptions =
      this._connectionController.getMongoClientConnectionOptions();
    if (!connectionOptions) {
      throw new Error('No connection options found');
    }
    // TODO: connect only once and reuse the connection for subsequent requests instead of reconnecting every time
    const serviceProvider = await NodeDriverServiceProvider.connect(
      connectionOptions.url,
      connectionOptions.options,
    );

    const findOptions: {
      limit: number;
      skip?: number;
      sort?: DocumentSort;
      promoteValues: false;
    } = {
      limit: DEFAULT_DOCUMENTS_LIMIT,
      promoteValues: false,
    };

    if (parsedQuery.skip) {
      // if the parsed query has a skip, we honor that so that the first page only starts after that skip value
      findOptions.skip = parsedQuery.skip;
    }
    if (skip !== undefined && skip > 0) {
      // we add the skip from the pagination onto the parsed query skip if it is exists
      findOptions.skip = (findOptions.skip ?? 0) + skip;
    }

    if (parsedQuery.limit) {
      // if the parsed query has a limit we want to honor that so that we don't go past it
      const remaining = parsedQuery.limit - (findOptions.skip ?? 0);
      if (remaining < 1) {
        // TODO: log
        return [];
      }
      findOptions.limit = limit ? Math.min(remaining, limit) : remaining;
    } else if (limit) {
      // otherwise we only have to take the limit from the pagination into account
      findOptions.limit = limit;
    }

    // Sort is only for a collection's documents list. It should be null if this
    // relates back to a find cursor so that we use the playground's sort
    // instead of overriding it.
    if (sort) {
      findOptions.sort = sort;
    }

    const executionOptions = signal ? { abortSignal: signal } : undefined;

    try {
      let cursor = serviceProvider.find(
        databaseName,
        collectionName,
        parsedQuery.find.filter,
        {
          ...parsedQuery.find.findOptions,
          ...findOptions,
        },
        {
          ...parsedQuery.find.dbOptions,
          ...executionOptions,
        },
      );
      for (const chain of parsedQuery.chains) {
        cursor = cursor[chain.method](...chain.args);
      }
      return await cursor.toArray();
    } finally {
      await serviceProvider.close();
    }
  }

  private async _fetchDocumentsForAggregate({
    databaseName,
    collectionName,
    limit,
    skip,
    signal,
    parsedQuery,
  }: FetchDocumentsParams & {
    parsedQuery: ParsedQuery & { aggregate: AggregateQuery };
  }): Promise<Document[]> {
    const connectionOptions =
      this._connectionController.getMongoClientConnectionOptions();
    if (!connectionOptions) {
      throw new Error('No connection options found');
    }
    // TODO: connect only once and reuse the connection for subsequent requests instead of reconnecting every time
    const serviceProvider = await NodeDriverServiceProvider.connect(
      connectionOptions.url,
      connectionOptions.options,
    );

    const executionOptions = signal ? { abortSignal: signal } : undefined;

    try {
      const pipeline = [
        ...parsedQuery.aggregate.pipeline,
        { $skip: skip },
        { $limit: limit },
      ];

      let cursor = serviceProvider.aggregate(
        databaseName,
        collectionName,
        pipeline,
        parsedQuery.aggregate.aggregateOptions,
        {
          ...parsedQuery.aggregate.dbOptions,
          ...executionOptions,
        },
      );

      for (const chain of parsedQuery.chains) {
        cursor = cursor[chain.method](...chain.args);
      }

      return await cursor.toArray();
    } finally {
      await serviceProvider.close();
    }
  }

  private async _fetchDocuments(
    options: FetchDocumentsParams,
  ): Promise<Document[]> {
    const parsedQuery = parseConstructionOptions(options.query);

    if (isFindParsedQuery(parsedQuery)) {
      return this._fetchDocumentsForFind({
        ...options,
        parsedQuery,
      });
    }

    if (isAggregateParsedQuery(parsedQuery)) {
      return this._fetchDocumentsForAggregate({
        ...options,
        parsedQuery,
      });
    }

    throw new Error(
      'Only find and aggregate queries are supported in data browsing for now',
    );
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

  private async _getTotalCount({
    databaseName,
    collectionName,
    query,
    collectionType,
    signal,
  }: {
    databaseName: string;
    collectionName: string;
    query?: CursorConstructionOptionsWithChains;
    collectionType: string;
    signal: AbortSignal;
  }): Promise<number | null> {
    // for now don't support total count for cursor queries, probably never
    // support it for views and time-series collections
    if (
      query ||
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
      `${databaseName}.${collectionName}`,
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
    log.info(
      'Opening data browser...',
      `${options.databaseName}.${options.collectionName}`,
    );
    const extensionPath = context.extensionPath;

    const panel = createWebviewPanel({
      viewType: 'mongodbDataBrowser',
      title: getWebViewTitle(
        options.databaseName,
        options.collectionName,
        !!options.query,
      ),
      extensionPath,
      iconName: 'leaf.svg',
    });

    panel.onDidDispose(() => this.onWebviewPanelClosed(panel));
    this._activeWebviewPanels.push(panel);

    panel.webview.html = getDataBrowsingContent({
      extensionPath,
      webview: panel.webview,
      databaseName: options.databaseName,
      collectionName: options.collectionName,
      query: JSON.stringify(options.query),
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
