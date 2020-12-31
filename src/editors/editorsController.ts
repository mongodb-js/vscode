import * as vscode from 'vscode';
import * as fse from 'fs-extra';
import * as os from 'os';
import { EJSON } from 'bson';
import * as path from 'path';
import CollectionDocumentsCodeLensProvider from './collectionDocumentsCodeLensProvider';
import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import CollectionDocumentsProvider, {
  CONNECTION_ID_URI_IDENTIFIER,
  OPERATION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER,
  VIEW_COLLECTION_SCHEME,
  DOCUMENT_LOCATION_URI_IDENTIFIER
} from './collectionDocumentsProvider';
import DocumentProvider, {
  DOCUMENT_ID_URI_IDENTIFIER,
  VIEW_DOCUMENT_SCHEME
} from './documentProvider';
import PlaygroundResultProvider, {
  PLAYGROUND_RESULT_SCHEME
} from './playgroundResultProvider';
import ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { StatusView } from '../views';
import PlaygroundController from './playgroundController';
import DocumentIdStore from './documentIdStore';
import TelemetryController from '../telemetry/telemetryController';

const log = createLogger('editors controller');

/**
 * This controller manages when our extension needs to open
 * new editors and the data they need. It also manages active editors.
 */
export default class EditorsController {
  _connectionController: ConnectionController;
  _documentIdStore: DocumentIdStore;
  _playgroundController: PlaygroundController;
  _collectionDocumentsOperationsStore = new CollectionDocumentsOperationsStore();
  _collectionViewProvider: CollectionDocumentsProvider;
  _documentViewProvider: DocumentProvider;
  _playgroundResultViewProvider: PlaygroundResultProvider;
  _context: vscode.ExtensionContext;
  _statusView: StatusView;
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

    const documentIdStore = new DocumentIdStore();
    this._documentIdStore = documentIdStore;

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

    const playgroundResultViewProvider = new PlaygroundResultProvider(
      playgroundController,
      new StatusView(context)
    );

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        PLAYGROUND_RESULT_SCHEME,
        playgroundResultViewProvider
      )
    );

    this._playgroundResultViewProvider = playgroundResultViewProvider;

    vscode.workspace.onDidCloseTextDocument((e) => {
      const uriParams = new URLSearchParams(e.uri.query);
      const documentIdReference =
        uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';

      this._documentIdStore.removeByDocumentIdReference(documentIdReference);
    });

    log.info('activated.');
  }

  provideDocumentContent(
    namespace: string,
    documentId: any,
    connectionId: string | null
  ): Promise<any> {
    log.info(
      'fetch document from MongoDB',
      namespace,
      documentId,
      connectionId
    );

    return new Promise((resolve, reject) => {
      const dataservice = this._connectionController.getActiveDataService();

      if (dataservice === null) {
        const errorMessage = `Unable to find document: no longer connected to ${connectionId}`;

        vscode.window.showErrorMessage(errorMessage);

        return reject(new Error(errorMessage));
      }

      this._statusView.showMessage('Fetching document...');

      dataservice.find(
        namespace,
        {
          _id: documentId
        },
        {
          limit: 1
        },
        (error: Error | undefined, documents: object[]) => {
          this._statusView.hideMessage();

          if (error) {
            const errorMessage = `Unable to find document: ${error.message}`;

            vscode.window.showErrorMessage(errorMessage);

            return reject(new Error(errorMessage));
          }

          if (!documents || documents.length === 0) {
            const errorMessage = `Unable to find document: ${JSON.stringify(
              documentId
            )}`;

            vscode.window.showErrorMessage(errorMessage);

            return reject(new Error(errorMessage));
          }

          return resolve(JSON.parse(EJSON.stringify(documents[0])));
        }
      );
    });
  }

  async onViewDocument(
    namespace: string,
    documentId: EJSON.SerializableTypes
  ): Promise<boolean> {
    log.info('view document from the sidebar in editor', namespace);

    const documentLocation = `${DOCUMENT_LOCATION_URI_IDENTIFIER}=mongodb`;
    const connectionId = this._connectionController.getActiveConnectionId();
    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${connectionId}`;
    const documentIdReference = this._documentIdStore.add(documentId);
    const documentIdUriQuery = `${DOCUMENT_ID_URI_IDENTIFIER}=${documentIdReference}`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${namespace}`;
    const localDocPath: string = path.join(
      os.tmpdir(),
      'vscode-opened-documents',
      `${documentIdReference}.json`
    );
    const document = await this.provideDocumentContent(
      namespace,
      documentId,
      connectionId
    );

    await fse.ensureFile(localDocPath);
    await fse.writeJson(localDocPath, document, {
      spaces: 2,
      EOL: os.EOL
    });

    const uri: vscode.Uri = vscode.Uri.file(localDocPath).with({
      query: `?${documentLocation}&${namespaceUriQuery}&${connectionIdUriQuery}&${documentIdUriQuery}`
    });

    return new Promise(async (resolve, reject) => {
      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window
          .showTextDocument(doc, { preview: false, preserveFocus: true })
          .then(() => resolve(true), reject);
      }, reject);
    });
  }

  saveDocumentToMongoDB(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const activeEditor = vscode.window.activeTextEditor;

      log.info('save document to MongoDB', activeEditor);

      if (!activeEditor) {
        return resolve(true);
      }

      const uriParams = new URLSearchParams(activeEditor.document.uri.query);
      const documentLocation =
        uriParams.get(DOCUMENT_LOCATION_URI_IDENTIFIER) || '';
      const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER) || '';
      const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
      const documentIdReference =
        uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';
      const documentId = this._documentIdStore.get(documentIdReference);

      if (
        documentLocation !== 'mongodb' ||
        !namespace ||
        !connectionId ||
        !documentId
      ) {
        vscode.commands.executeCommand('workbench.action.files.save');

        return resolve(true);
      }

      const activeConnectionId = this._connectionController.getActiveConnectionId();
      const connectionName = this._connectionController.getSavedConnectionName(
        connectionId
      );

      if (activeConnectionId !== connectionId) {
        // Send metrics to Segment.
        this._telemetryController.trackDocumentUpdated('treeview', false);

        vscode.window.showErrorMessage(
          `Unable to save document: no longer connected to '${connectionName}'`
        );

        return resolve(false);
      }

      const dataservice = this._connectionController.getActiveDataService();

      if (dataservice === null) {
        // Send metrics to Segment.
        this._telemetryController.trackDocumentUpdated('treeview', false);

        vscode.window.showErrorMessage(
          `Unable to save document: no longer connected to '${connectionName}'`
        );

        return resolve(false);
      }

      this._statusView.showMessage('Saving document...');

      let newDocument: EJSON.SerializableTypes = {};

      try {
        newDocument = EJSON.parse(activeEditor?.document.getText());
      } catch (error) {
        // Send metrics to Segment.
        this._telemetryController.trackDocumentUpdated('treeview', false);

        vscode.window.showErrorMessage(error.message);

        return resolve(false);
      }

      dataservice.findOneAndReplace(
        namespace,
        {
          _id: documentId
        },
        newDocument,
        {
          returnOriginal: false
        },
        (error) => {
          this._statusView.hideMessage();

          if (error) {
            const errorMessage = `Unable to save document: ${error.message}`;

            // Send metrics to Segment.
            this._telemetryController.trackDocumentUpdated('treeview', false);

            vscode.window.showErrorMessage(errorMessage);

            return resolve(false);
          }

          // Send metrics to Segment.
          this._telemetryController.trackDocumentUpdated('treeview', true);

          activeEditor?.document.save();
          vscode.window.showInformationMessage(
            `The document was saved successfully to '${namespace}'`
          );

          return resolve(true);
        }
      );

      return resolve(true);
    });
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
