import * as util from 'util';
import * as vscode from 'vscode';
import { EJSON, Document } from 'bson';

import ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { DocumentSource } from '../documentSource';
import type { EditDocumentInfo } from '../types/editDocumentInfoType';
import formatError from '../utils/formatError';
import { StatusView } from '../views';
import TelemetryService from '../telemetry/telemetryService';

const log = createLogger('document controller');

export const DOCUMENT_ID_URI_IDENTIFIER = 'documentId';

export const DOCUMENT_SOURCE_URI_IDENTIFIER = 'source';

export const VIEW_DOCUMENT_SCHEME = 'VIEW_DOCUMENT_SCHEME';

export default class MongoDBDocumentService {
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _statusView: StatusView;
  _telemetryService: TelemetryService;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    statusView: StatusView,
    telemetryService: TelemetryService
  ) {
    this._context = context;
    this._connectionController = connectionController;
    this._statusView = statusView;
    this._telemetryService = telemetryService;
  }

  _fetchDocumentFailed(message: string): void {
    const errorMessage = `Unable to fetch document: ${message}`;

    throw new Error(errorMessage);
  }

  _saveDocumentFailed(message: string): void {
    const errorMessage = `Unable to save document: ${message}`;

    this._telemetryService.trackDocumentUpdated(
      DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
      false
    );

    throw new Error(errorMessage);
  }

  async replaceDocument(data: {
    documentId: EJSON.SerializableTypes;
    namespace: string;
    connectionId: string;
    newDocument: EJSON.SerializableTypes;
    source: DocumentSource;
  }): Promise<void> {
    log.info('Replace document in MongoDB', data);

    const { documentId, namespace, connectionId, newDocument, source } = data;
    const activeConnectionId =
      this._connectionController.getActiveConnectionId();
    const connectionName =
      this._connectionController.getSavedConnectionName(connectionId);

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

    this._statusView.showMessage('Saving document...');

    try {
      const findOneAndReplace = util.promisify(
        dataservice.findOneAndReplace.bind(dataservice)
      );
      await findOneAndReplace(
        namespace,
        { _id: documentId },
        newDocument as Document,
        { returnDocument: 'after' }
      );

      this._statusView.hideMessage();
      this._telemetryService.trackDocumentUpdated(source, true);
    } catch (error) {
      this._statusView.hideMessage();

      return this._saveDocumentFailed(formatError(error).message);
    }
  }

  async fetchDocument(
    data: EditDocumentInfo
  ): Promise<EJSON.SerializableTypes | void> {
    log.info('Fetch document from MongoDB', data);

    const { documentId, namespace, connectionId } = data;
    const activeConnectionId =
      this._connectionController.getActiveConnectionId();
    const connectionName = connectionId
      ? this._connectionController.getSavedConnectionName(connectionId)
      : 'the database';

    if (activeConnectionId !== connectionId) {
      return this._fetchDocumentFailed(
        `no longer connected to '${connectionName}'`
      );
    }

    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      return this._fetchDocumentFailed(
        `no longer connected to ${connectionName}`
      );
    }

    this._statusView.showMessage('Fetching document...');

    try {
      const documents = await dataservice.find(
        namespace,
        { _id: documentId },
        { limit: 1 }
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

      return this._fetchDocumentFailed(formatError(error).message);
    }
  }
}
