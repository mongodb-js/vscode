import * as vscode from 'vscode';
import { EJSON } from 'bson';
import DocumentIdStore from './documentIdStore';
import {
  CONNECTION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER
} from './collectionDocumentsProvider';
import ConnectionController from '../connectionController';
import { StatusView } from '../views';
import TelemetryController from '../telemetry/telemetryController';
import { DataServiceType } from '../dataServiceType';
import { createLogger } from '../logging';
import EXTENSION_COMMANDS from '../commands';
import { MemoryFileSystemProvider } from './memoryFileSystemProvider';
import util from 'util';

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

  async _fetchDocument(
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

    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      const errorMessage = `Unable to find document: no longer connected to ${connectionId}`;

      throw new Error(errorMessage);
    }

    const find = util.promisify(dataservice.find.bind(dataservice));

    this._statusView.showMessage('Fetching document...');

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
        const errorMessage = `Unable to find document: ${JSON.stringify(
          documentId
        )}`;

        throw new Error(errorMessage);
      }

      this._statusView.hideMessage();

      return JSON.parse(EJSON.stringify(documents[0]));
    } catch (error) {
      const errorMessage = `Unable to find document: ${error.message}`;

      this._statusView.hideMessage();
      vscode.window.showErrorMessage(errorMessage);

      return null;
    }
  }

  _saveDocumentFailed(errorMessage: string): boolean {
    // Send a telemetry event that saving the document failed.
    this._telemetryController.trackDocumentUpdated('treeview', false);

    vscode.window.showErrorMessage(errorMessage);

    return false;
  }

  async _replaceDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
    dataservice: DataServiceType;
  }): Promise<boolean> {
    const { documentId, namespace, dataservice } = data;
    const activeEditor = vscode.window.activeTextEditor;
    let newDocument: EJSON.SerializableTypes = {};

    try {
      newDocument = EJSON.parse(activeEditor?.document.getText() || '');
    } catch (error) {
      return this._saveDocumentFailed(error.message);
    }

    this._statusView.showMessage('Saving document...');

    const findOneAndReplace = util.promisify(
      dataservice.findOneAndReplace.bind(dataservice)
    );

    try {
      const document = await findOneAndReplace(
        namespace,
        {
          _id: documentId
        },
        newDocument,
        {
          returnOriginal: false
        }
      );

      this._statusView.hideMessage();

      // Send metrics to Segment.
      this._telemetryController.trackDocumentUpdated('treeview', true);

      // Save document changes to active editor.
      activeEditor?.document.save();

      // Update parent list of documents to reflect the changes that were made.
      vscode.commands.executeCommand(
        EXTENSION_COMMANDS.MDB_REFRESH_PLAYGROUND_RESULT_CONTENT,
        document
      );

      vscode.window.showInformationMessage(
        `The document was saved successfully to '${namespace}'`
      );

      return true;
    } catch (error) {
      const errorMessage = `Unable to save document: ${error.message}`;

      this._statusView.hideMessage();

      return this._saveDocumentFailed(errorMessage);
    }
  }

  async saveMongoDBDocument(): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;

    log.info('save document to MongoDB', activeEditor);

    if (!activeEditor) {
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

    const activeConnectionId = this._connectionController.getActiveConnectionId();
    const connectionName = this._connectionController.getSavedConnectionName(
      connectionId
    );

    if (activeConnectionId !== connectionId) {
      return this._saveDocumentFailed(
        `Unable to save document: no longer connected to '${connectionName}'`
      );
    }

    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      return this._saveDocumentFailed(
        `Unable to save document: no longer connected to '${connectionName}'`
      );
    }

    return await this._replaceDocument({
      documentId,
      namespace,
      dataservice
    });
  }

  async openMongoDBDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
  }): Promise<vscode.Uri | undefined> {
    const connectionId = this._connectionController.getActiveConnectionId();
    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${connectionId}`;
    const documentIdReference = this._documentIdStore.add(data.documentId);
    const documentIdUriQuery = `${DOCUMENT_ID_URI_IDENTIFIER}=${documentIdReference}`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${data.namespace}`;
    const document = await this._fetchDocument(
      data.namespace,
      data.documentId,
      connectionId
    );

    if (!document) {
      return;
    }

    const fileName = `${VIEW_DOCUMENT_SCHEME}:/${data.namespace}:${documentIdReference}.json`;
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
}
