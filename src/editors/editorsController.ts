import * as vscode from 'vscode';
import { EJSON } from 'bson';
import CollectionDocumentsCodeLensProvider from './collectionDocumentsCodeLensProvider';
import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import ActiveConnectionCodeLensProvider from './activeConnectionCodeLensProvider';
import PartialExecutionCodeLensProvider from './partialExecutionCodeLensProvider';
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
import MongoDBDocumentService, {
  DOCUMENT_ID_URI_IDENTIFIER,
  DOCUMENT_SOURCE_URI_IDENTIFIER,
  VIEW_DOCUMENT_SCHEME
} from './mongoDBDocumentService';
import { MemoryFileSystemProvider } from './memoryFileSystemProvider';
import TelemetryService from '../telemetry/telemetryService';
import PlaygroundResultProvider, {
  PLAYGROUND_RESULT_SCHEME
} from './playgroundResultProvider';
import type { ResultCodeLensInfo } from '../utils/types';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';

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
  _mongoDBDocumentService: MongoDBDocumentService;
  _telemetryService: TelemetryService;
  _playgroundResultViewProvider: PlaygroundResultProvider;
  _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  _partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider;
  _editDocumentCodeLensProviderPlayground: EditDocumentCodeLensProvider;
  _collectionDocumentsCodeLensProvider: CollectionDocumentsCodeLensProvider;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    playgroundController: PlaygroundController,
    statusView: StatusView,
    telemetryService: TelemetryService,
    playgroundResultViewProvider: PlaygroundResultProvider,
    activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider,
    partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider,
    editDocumentCodeLensProviderPlayground: EditDocumentCodeLensProvider
  ) {
    log.info('activating...');

    this._connectionController = connectionController;
    this._playgroundController = playgroundController;
    this._context = context;
    this._statusView = statusView;
    this._telemetryService = telemetryService;
    this._memoryFileSystemProvider = new MemoryFileSystemProvider();
    this._documentIdStore = new DocumentIdStore();
    this._mongoDBDocumentService = new MongoDBDocumentService(
      this._context,
      this._documentIdStore,
      this._connectionController,
      this._statusView,
      this._telemetryService
    );
    this._editDocumentCodeLensProviderPlayground = editDocumentCodeLensProviderPlayground;
    this._collectionViewProvider = new CollectionDocumentsProvider(
      this._context,
      connectionController,
      this._collectionDocumentsOperationsStore,
      new StatusView(context)
    );
    this._playgroundResultViewProvider = playgroundResultViewProvider;
    this._activeConnectionCodeLensProvider = activeConnectionCodeLensProvider;
    this._partialExecutionCodeLensProvider = partialExecutionCodeLensProvider;
    this._collectionDocumentsCodeLensProvider = new CollectionDocumentsCodeLensProvider(
      this._collectionDocumentsOperationsStore
    );

    vscode.workspace.onDidCloseTextDocument((e) => {
      const uriParams = new URLSearchParams(e.uri.query);
      const documentIdReference =
        uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';

      this._documentIdStore.removeByDocumentIdReference(documentIdReference);
    });

    log.info('activated.');
  }

  async openMongoDBDocument(data: ResultCodeLensInfo): Promise<boolean> {
    try {
      let fileDocumentId = EJSON.stringify(data.documentId);

      fileDocumentId =
        fileDocumentId.length > 50
          ? fileDocumentId.substring(0, 50)
          : fileDocumentId;

      const fileName = `${VIEW_DOCUMENT_SCHEME}:/${data.namespace}:${fileDocumentId}.json`;
      const mdbDocument = (await this._mongoDBDocumentService.fetchDocument(
        data
      )) as EJSON.SerializableTypes;

      if (mdbDocument === null) {
        vscode.window.showErrorMessage(`
          Unable to open mongodb document: document ${JSON.stringify(data.documentId)} not found
        `);

        return false;
      }

      this._saveDocumentToMemoryFileSystem(fileName, mdbDocument);

      const activeConnectionId =
        this._connectionController.getActiveConnectionId() || '';
      const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${data.namespace}`;
      const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${activeConnectionId}`;
      const documentIdReference = this._documentIdStore.add(data.documentId);
      const documentIdUriQuery = `${DOCUMENT_ID_URI_IDENTIFIER}=${documentIdReference}`;
      const documentSourceUriQuery = `${DOCUMENT_SOURCE_URI_IDENTIFIER}=${data.source}`;
      const uri: vscode.Uri = vscode.Uri.parse(fileName).with({
        query: `?${namespaceUriQuery}&${connectionIdUriQuery}&${documentIdUriQuery}&${documentSourceUriQuery}`
      });
      const document = await vscode.workspace.openTextDocument(uri);

      await vscode.window.showTextDocument(document, { preview: false });

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(printableError.message);

      return false;
    }
  }

  async saveMongoDBDocument(): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      vscode.window.showErrorMessage('Unable to save mongodb document: The active editor cannot be found');

      return false;
    }

    const uriParams = new URLSearchParams(activeEditor.document.uri.query);
    const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER);
    const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
    const documentIdReference = uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';
    const documentId = this._documentIdStore.get(documentIdReference);
    const source = uriParams.get(DOCUMENT_SOURCE_URI_IDENTIFIER) || '';

    // If not MongoDB document save to disk instead of MongoDB.
    if (
      activeEditor.document.uri.scheme !== 'VIEW_DOCUMENT_SCHEME' ||
      !namespace ||
      !connectionId ||
      // A valid documentId can be false.
      documentId === null ||
      documentId === undefined
    ) {
      await vscode.commands.executeCommand('workbench.action.files.save');

      return false;
    }

    try {
      const newDocument = EJSON.parse(activeEditor.document.getText() || '');

      await this._mongoDBDocumentService.replaceDocument({
        namespace,
        connectionId,
        documentId,
        newDocument,
        source
      });

      // Save document changes to active editor.
      activeEditor?.document.save();

      vscode.window.showInformationMessage(
        `The document was saved successfully to '${namespace}'`
      );

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(printableError.message);

      return false;
    }
  }

  static getViewCollectionDocumentsUri(
    operationId: string,
    namespace: string,
    connectionId: string
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

  async onViewCollectionDocuments(namespace: string): Promise<boolean> {
    log.info('view collection documents', namespace);

    const operationId = this._collectionDocumentsOperationsStore.createNewOperation();
    const activeConnectionId =
      this._connectionController.getActiveConnectionId() || '';
    const uri = EditorsController.getViewCollectionDocumentsUri(
      operationId,
      namespace,
      activeConnectionId
    );

    try {
      const document = await vscode.workspace.openTextDocument(uri);

      await vscode.window.showTextDocument(document, { preview: false });

      return true;
    } catch (error) {
      const printableError = error as { message: string };

      vscode.window.showErrorMessage(
        `Unable to open documents: ${printableError.message}`
      );

      return false;
    }
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
      vscode.window.showErrorMessage(
        'Already fetching more documents...'
      );

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

  _saveDocumentToMemoryFileSystem(
    fileName: string,
    document: EJSON.SerializableTypes
  ): void {
    this._memoryFileSystemProvider.writeFile(
      vscode.Uri.parse(fileName),
      Buffer.from(JSON.stringify(document, null, 2)),
      { create: true, overwrite: true }
    );
  }

  _resetMemoryFileSystemProvider(): void {
    const prefix = `${VIEW_DOCUMENT_SCHEME}:/`;

    for (const [name] of this._memoryFileSystemProvider.readDirectory(
      vscode.Uri.parse(prefix)
    )) {
      this._memoryFileSystemProvider.delete(
        vscode.Uri.parse(`${prefix}${name}`)
      );
    }
  }

  registerProviders(): void {
    this._context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(
        VIEW_DOCUMENT_SCHEME,
        this._memoryFileSystemProvider,
        {
          isCaseSensitive: true
        }
      )
    );
    // REGISTER CONTENT
    this._context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VIEW_COLLECTION_SCHEME,
        this._collectionViewProvider
      )
    );
    this._context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        PLAYGROUND_RESULT_SCHEME,
        this._playgroundResultViewProvider
      )
    );
    // REGISTER CODE LENSES
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        {
          scheme: VIEW_COLLECTION_SCHEME,
          language: 'json'
        },
        this._collectionDocumentsCodeLensProvider
      )
    );
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this._activeConnectionCodeLensProvider
      )
    );
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language: 'mongodb' },
        this._partialExecutionCodeLensProvider
      )
    );
    this._context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        {
          scheme: PLAYGROUND_RESULT_SCHEME,
          language: 'json'
        },
        this._editDocumentCodeLensProviderPlayground
      )
    );
  }

  public deactivate(): void {
    this._resetMemoryFileSystemProvider();
  }
}
