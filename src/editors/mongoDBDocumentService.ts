import * as vscode from 'vscode';
import { EJSON } from 'bson';
import DocumentIdStore from './documentIdStore';
import ConnectionController from '../connectionController';
import { StatusView } from '../views';
import TelemetryController from '../telemetry/telemetryController';
import { createLogger } from '../logging';
import util from 'util';

export const DOCUMENT_ID_URI_IDENTIFIER = 'documentId';

export const VIEW_DOCUMENT_SCHEME = 'VIEW_DOCUMENT_SCHEME';

const log = createLogger('document controller');

export default class MongoDBDocumentService {
  _context: vscode.ExtensionContext;
  _documentIdStore: DocumentIdStore;
  _connectionController: ConnectionController;
  _statusView: StatusView;
  _telemetryController: TelemetryController;

  constructor(
    context: vscode.ExtensionContext,
    documentIdStore: DocumentIdStore,
    connectionController: ConnectionController,
    statusView: StatusView,
    telemetryController: TelemetryController
  ) {
    this._context = context;
    this._documentIdStore = documentIdStore;
    this._connectionController = connectionController;
    this._statusView = statusView;
    this._telemetryController = telemetryController;
  }

  _fetchDocumentFailed(message: string): void {
    const errorMessage = `Unable to fetch document: ${message}`;

    throw new Error(errorMessage);
  }

  _saveDocumentFailed(message: string): void {
    const errorMessage = `Unable to save document: ${message}`;

    // Send a telemetry event that saving the document failed.
    this._telemetryController.trackDocumentUpdated('treeview', false);

    throw new Error(errorMessage);
  }

  async replaceDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
    connectionId: string;
    newDocument: EJSON.SerializableTypes;
  }): Promise<void> {
    log.info('replace document in MongoDB', data);

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

    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      return this._saveDocumentFailed(
        `no longer connected to '${connectionName}'`
      );
    }

    const findOneAndReplace = util.promisify(
      dataservice.findOneAndReplace.bind(dataservice)
    );

    this._statusView.showMessage('Saving document...');

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

      this._statusView.hideMessage();
      this._telemetryController.trackDocumentUpdated('treeview', true);
    } catch (error) {
      this._statusView.hideMessage();

      return this._saveDocumentFailed(error.message);
    }
  }

  async fetchDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
  }): Promise<EJSON.SerializableTypes | void> {
    log.info('fetch document from MongoDB', data);

    const { documentId, namespace } = data;
    const activeConnectionId = this._connectionController.getActiveConnectionId();
    const connectionName = activeConnectionId
      ? this._connectionController.getSavedConnectionName(activeConnectionId)
      : '';
    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      return this._fetchDocumentFailed(
        `no longer connected to ${connectionName}`
      );
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

      this._statusView.hideMessage();

      if (!documents || documents.length === 0) {
        return null;
      }

      return JSON.parse(
        EJSON.stringify(documents[0])
      ) as EJSON.SerializableTypes;
    } catch (error) {
      this._statusView.hideMessage();

      return this._fetchDocumentFailed(error.message);
    }
  }
}
