import * as vscode from 'vscode';
import { EJSON } from 'bson';
import DocumentIdStore from './documentIdStore';
import ConnectionController from '../connectionController';
import { StatusView } from '../views';
import TelemetryController from '../telemetry/telemetryController';
import { createLogger } from '../logging';
import { MemoryFileSystemProvider } from './memoryFileSystemProvider';
import util from 'util';
import {
  CONNECTION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER
} from './collectionDocumentsProvider';

export const DOCUMENT_ID_URI_IDENTIFIER = 'documentId';

export const VIEW_DOCUMENT_SCHEME = 'VIEW_DOCUMENT_SCHEME';

const log = createLogger('document controller');

export default class DocumentController {
  _context: vscode.ExtensionContext;
  _documentIdStore: DocumentIdStore;
  _connectionController: ConnectionController;
  _statusView: StatusView;
  _telemetryController: TelemetryController;
  _memoryFileSystemProvider: MemoryFileSystemProvider;

  constructor(
    context: vscode.ExtensionContext,
    documentIdStore: DocumentIdStore,
    connectionController: ConnectionController,
    statusView: StatusView,
    telemetryController: TelemetryController,
    memoryFileSystemProvider: MemoryFileSystemProvider
  ) {
    this._context = context;
    this._documentIdStore = documentIdStore;
    this._connectionController = connectionController;
    this._statusView = statusView;
    this._telemetryController = telemetryController;
    this._memoryFileSystemProvider = memoryFileSystemProvider;
  }

  _fetchDocumentFailed(message: string): void {
    this._statusView.hideMessage();

    const errorMessage = `Unable to fetch document: ${message}`;

    throw new Error(errorMessage);
  }

  _saveDocumentFailed(message: string): void {
    this._statusView.hideMessage();

    const errorMessage = `Unable to save document: ${message}`;

    // Send a telemetry event that saving the document failed.
    this._telemetryController.trackDocumentUpdated('treeview', false);

    throw new Error(errorMessage);
  }

  async _fetchDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
    connectionName: string;
  }): Promise<any> {
    log.info('fetch document from MongoDB', data);

    const { documentId, namespace, connectionName } = data;
    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      return this._fetchDocumentFailed(
        `no longer connected to ${connectionName}`
      );
    }

    const find = util.promisify(dataservice.find.bind(dataservice));

    try {
      const documents = await find(
        namespace,
        {
          _id: documentId
        },
        {
          limit: 1
        }
      );

      if (!documents || documents.length === 0) {
        return null;
      }

      return JSON.parse(EJSON.stringify(documents[0]));
    } catch (error) {
      return this._fetchDocumentFailed(error.message);
    }
  }

  async _replaceDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
    connectionName: string;
    newDocument: EJSON.SerializableTypes;
  }): Promise<void> {
    log.info('replace document in MongoDB', data);

    const { documentId, namespace, connectionName, newDocument } = data;
    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      return this._saveDocumentFailed(
        `no longer connected to '${connectionName}'`
      );
    }

    const findOneAndReplace = util.promisify(
      dataservice.findOneAndReplace.bind(dataservice)
    );

    try {
      await findOneAndReplace(
        namespace,
        {
          _id: documentId
        },
        newDocument,
        {
          returnOriginal: false
        }
      );

      this._telemetryController.trackDocumentUpdated('treeview', true);
    } catch (error) {
      return this._saveDocumentFailed(error.message);
    }
  }

  async saveMongoDBDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
    connectionId: string;
    newDocument: EJSON.SerializableTypes;
  }): Promise<void> {
    const { documentId, namespace, connectionId, newDocument } = data;
    const activeConnectionId = this._connectionController.getActiveConnectionId();
    const connectionName = this._connectionController.getSavedConnectionName(
      connectionId
    );

    if (activeConnectionId !== connectionId) {
      return this._saveDocumentFailed(
        `no longer connected to '${connectionName}'`
      );
    }

    this._statusView.showMessage('Saving document...');
    await this._replaceDocument({
      documentId,
      namespace,
      connectionName,
      newDocument
    });
    this._statusView.hideMessage();
  }

  async openMongoDBDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
  }): Promise<vscode.Uri> {
    const { documentId, namespace } = data;
    const activeConnectionId = this._connectionController.getActiveConnectionId();
    let connectionName = '';

    if (activeConnectionId) {
      connectionName = this._connectionController.getSavedConnectionName(
        activeConnectionId
      );
    }

    this._statusView.showMessage('Fetching document...');
    const document = await this._fetchDocument({
      documentId,
      namespace,
      connectionName
    });
    this._statusView.hideMessage();

    let fileDocumentId = EJSON.stringify(document['_id']);

    fileDocumentId =
      fileDocumentId.length > 50
        ? fileDocumentId.substring(0, 50)
        : fileDocumentId;

    const fileName = `${VIEW_DOCUMENT_SCHEME}:/${data.namespace}:${fileDocumentId}.json`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${data.namespace}`;
    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${activeConnectionId}`;
    const documentIdReference = this._documentIdStore.add(data.documentId);
    const documentIdUriQuery = `${DOCUMENT_ID_URI_IDENTIFIER}=${documentIdReference}`;
    const uri: vscode.Uri = vscode.Uri.parse(fileName).with({
      query: `?${namespaceUriQuery}&${connectionIdUriQuery}&${documentIdUriQuery}`
    });

    this._memoryFileSystemProvider.writeFile(
      vscode.Uri.parse(fileName),
      Buffer.from(JSON.stringify(document, null, 2)),
      { create: true, overwrite: true }
    );

    return uri;
  }

  resetMemoryFileSystemProvider(): void {
    const prefix = `${VIEW_DOCUMENT_SCHEME}:/`;

    for (const [name] of this._memoryFileSystemProvider.readDirectory(
      vscode.Uri.parse(prefix)
    )) {
      this._memoryFileSystemProvider.delete(
        vscode.Uri.parse(`${prefix}${name}`)
      );
    }
  }
}
