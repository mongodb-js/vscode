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
import ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { StatusView } from '../views';
import PlaygroundController from './playgroundController';
import DocumentIdStore from './documentIdStore';
import DocumentController, {
  DOCUMENT_ID_URI_IDENTIFIER,
  VIEW_DOCUMENT_SCHEME
} from './documentController';
import { MemoryFileSystemProvider } from './memoryFileSystemProvider';
import TelemetryController from '../telemetry/telemetryController';

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
  _context: vscode.ExtensionContext;
  _statusView: StatusView;
  _memoryFileSystemProvider: MemoryFileSystemProvider;
  _documentIdStore: DocumentIdStore;
  _documentController: DocumentController;
  _telemetryController: TelemetryController;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    playgroundController: PlaygroundController,
    statusView: StatusView,
    telemetryController: TelemetryController
  ) {
    log.info('activating...');

    this._connectionController = connectionController;
    this._playgroundController = playgroundController;
    this._context = context;
    this._statusView = statusView;
    this._telemetryController = telemetryController;
    this._memoryFileSystemProvider = new MemoryFileSystemProvider();
    this._documentIdStore = new DocumentIdStore();
    this._documentController = new DocumentController(
      this._context,
      this._documentIdStore,
      this._connectionController,
      this._statusView,
      this._telemetryController,
      this._memoryFileSystemProvider
    );

    this._documentController = new DocumentController(
      context,
      this._documentIdStore,
      this._connectionController,
      this._statusView,
      this._telemetryController,
      this._memoryFileSystemProvider
    );

    context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(
        VIEW_DOCUMENT_SCHEME,
        this._memoryFileSystemProvider,
        {
          isCaseSensitive: true
        }
      )
    );

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

    vscode.workspace.onDidCloseTextDocument((e) => {
      const uriParams = new URLSearchParams(e.uri.query);
      const documentIdReference =
        uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';

      this._documentIdStore.removeByDocumentIdReference(documentIdReference);
    });

    log.info('activated.');
  }

  async openMongoDBDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
  }): Promise<boolean> {
    const uri = await this._documentController.openMongoDBDocument(data);

    return new Promise(async (resolve, reject) => {
      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window
          .showTextDocument(doc, { preview: false })
          .then(() => resolve(true), reject);
      }, reject);
    });
  }

  async saveMongoDBDocument(): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      vscode.window.showErrorMessage('The active editor cannot be found');

      return false;
    }

    const uriParams = new URLSearchParams(activeEditor.document.uri.query);
    const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER);
    const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
    const documentIdReference = uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';
    const documentId = this._documentIdStore.get(documentIdReference);

    // If not MongoDB document save to disk instead of MongoDB.
    if (
      activeEditor.document.uri.scheme !== 'VIEW_DOCUMENT_SCHEME' ||
      !namespace ||
      !connectionId ||
      !documentId
    ) {
      vscode.commands.executeCommand('workbench.action.files.save');

      return false;
    }

    try {
      const newDocument = EJSON.parse(activeEditor.document.getText() || '');

      await this._documentController.saveMongoDBDocument({
        namespace,
        connectionId,
        documentId,
        newDocument
      });

      // Save document changes to active editor.
      activeEditor?.document.save();

      vscode.window.showInformationMessage(
        `The document was saved successfully to '${namespace}'`
      );

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(error.message);

      return false;
    }
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
