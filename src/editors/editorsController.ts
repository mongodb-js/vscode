import * as vscode from 'vscode';
import { EJSON } from 'bson';
import CollectionDocumentsCodeLensProvider from './collectionDocumentsCodeLensProvider';
import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import CollectionDocumentsProvider, {
  CONNECTION_ID_URI_IDENTIFIER,
  OPERATION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER,
  VIEW_COLLECTION_SCHEME
} from './collectionDocumentsProvider';
import DocumentProvider, {
  DOCUMENT_ID_URI_IDENTIFIER,
  VIEW_DOCUMENT_SCHEME
} from './documentProvider';
import ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { StatusView } from '../views';
import PlaygroundController from './playgroundController';
import DocumentIdStore from './documentIdStore';
import DocumentController from './documentController';

const log = createLogger('editors controller');

/**
 * This controller manages when our extension needs to open
 * new editors and the data they need. It also manages active editors.
 */
export default class EditorsController {
  _connectionController: ConnectionController;
  _playgroundController: PlaygroundController;
  _collectionDocumentsOperationsStore = new CollectionDocumentsOperationsStore();
  _collectionViewProvider: CollectionDocumentsProvider;
  _documentViewProvider: DocumentProvider;
  _context: vscode.ExtensionContext;
  _statusView: StatusView;
  _documentIdStore: DocumentIdStore;
  _documentController: DocumentController;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    playgroundController: PlaygroundController,
    statusView: StatusView,
    documentIdStore: DocumentIdStore,
    documentController: DocumentController
  ) {
    log.info('activating...');

    this._connectionController = connectionController;
    this._playgroundController = playgroundController;
    this._context = context;
    this._statusView = statusView;
    this._documentIdStore = documentIdStore;
    this._documentController = documentController;

    const collectionViewProvider = new CollectionDocumentsProvider(
      connectionController,
      this._collectionDocumentsOperationsStore,
      new StatusView(context)
    );

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VIEW_COLLECTION_SCHEME,
        collectionViewProvider
      )
    );
    this._collectionViewProvider = collectionViewProvider;

    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        {
          scheme: VIEW_COLLECTION_SCHEME,
          language: 'json'
        },
        new CollectionDocumentsCodeLensProvider(
          this._collectionDocumentsOperationsStore
        )
      )
    );

    const documentViewProvider = new DocumentProvider(
      connectionController,
      documentIdStore,
      new StatusView(context)
    );

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VIEW_DOCUMENT_SCHEME,
        documentViewProvider
      )
    );
    this._documentViewProvider = documentViewProvider;

    vscode.workspace.onDidCloseTextDocument((e) => {
      const uriParams = new URLSearchParams(e.uri.query);
      const documentIdReference =
        uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';

      this._documentIdStore.removeByDocumentIdReference(documentIdReference);
    });

    log.info('activated.');
  }

  async onViewDocument(
    namespace: string,
    documentId: EJSON.SerializableTypes
  ): Promise<boolean> {
    log.info('view document from the sidebar in editor', namespace);

    return this._documentController.openEditableDocument(documentId, namespace);
  }

  static getViewCollectionDocumentsUri(
    operationId,
    namespace,
    connectionId
  ): vscode.Uri {
    // We attach a unique id to the query so that it creates a new file in
    // the editor and so that we can virtually manage the amount of docs shown.
    const operationIdUriQuery = `${OPERATION_ID_URI_IDENTIFIER}=${operationId}`;
    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${connectionId}`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${namespace}`;
    const uriQuery = `?${namespaceUriQuery}&${connectionIdUriQuery}&${operationIdUriQuery}`;

    // The part of the URI after the scheme and before the query is the file name.
    return vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${namespace}.json${uriQuery}`
    );
  }

  onViewCollectionDocuments(namespace: string): Promise<boolean> {
    log.info('view collection documents', namespace);

    const operationId = this._collectionDocumentsOperationsStore.createNewOperation();

    const uri = EditorsController.getViewCollectionDocumentsUri(
      operationId,
      namespace,
      this._connectionController.getActiveConnectionId()
    );
    return new Promise((resolve, reject) => {
      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window
          .showTextDocument(doc, { preview: false })
          .then(() => resolve(true), reject);
      }, reject);
    });
  }

  onViewMoreCollectionDocuments(
    operationId: string,
    connectionId: string,
    namespace: string
  ): Promise<boolean> {
    log.info('view more collection documents', namespace);

    // A user might click to fetch more documents multiple times,
    // this ensures it only performs one fetch at a time.
    if (
      this._collectionDocumentsOperationsStore.operations[operationId]
        .isCurrentlyFetchingMoreDocuments
    ) {
      vscode.window.showErrorMessage('Already fetching more documents...');
      return Promise.resolve(false);
    }

    // Ensure we're still connected to the correct connection.
    if (connectionId !== this._connectionController.getActiveConnectionId()) {
      vscode.window.showErrorMessage(
        `Unable to view more documents: no longer connected to ${connectionId}`
      );
      return Promise.resolve(false);
    }

    if (!this._collectionViewProvider) {
      return Promise.reject(
        new Error('No registered collection view provider.')
      );
    }

    const uri = EditorsController.getViewCollectionDocumentsUri(
      operationId,
      namespace,
      connectionId
    );

    this._collectionDocumentsOperationsStore.increaseOperationDocumentLimit(
      operationId
    );

    // Notify the document provider to update with the new document limit.
    this._collectionViewProvider.onDidChangeEmitter.fire(uri);
    return Promise.resolve(true);
  }
}
