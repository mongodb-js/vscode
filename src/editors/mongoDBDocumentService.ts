import type * as vscode from 'vscode';
import type { Document } from 'bson';

import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { DocumentSource } from '../documentSource';
import type { EditDocumentInfo } from '../types/editDocumentInfoType';
import formatError from '../utils/formatError';
import type { StatusView } from '../views';
import type { TelemetryService } from '../telemetry';
import { getEJSON } from '../utils/ejson';
import { DocumentUpdatedTelemetryEvent } from '../telemetry';

const log = createLogger('document controller');

export const DOCUMENT_ID_URI_IDENTIFIER = 'documentId';

export const URI_IDENTIFIER = 'source';

export const VIEW_DOCUMENT_SCHEME = 'VIEW_DOCUMENT_SCHEME';

export default class MongoDBDocumentService {
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _statusView: StatusView;
  _telemetryService: TelemetryService;

  constructor({
    context,
    connectionController,
    statusView,
    telemetryService,
  }: {
    context: vscode.ExtensionContext;
    connectionController: ConnectionController;
    statusView: StatusView;
    telemetryService: TelemetryService;
  }) {
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

    this._telemetryService.track(
      new DocumentUpdatedTelemetryEvent(DocumentSource.TREEVIEW, false),
    );

    throw new Error(errorMessage);
  }

  async replaceDocument(data: {
    documentId: any;
    namespace: string;
    connectionId: string;
    newDocument: Document;
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
        `no longer connected to '${connectionName}'`,
      );
    }

    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      return this._saveDocumentFailed(
        `no longer connected to '${connectionName}'`,
      );
    }

    this._statusView.showMessage('Saving document...');

    try {
      await dataService.findOneAndReplace(
        namespace,
        { _id: documentId },
        newDocument,
        {
          returnDocument: 'after',
        },
      );
      this._telemetryService.track(
        new DocumentUpdatedTelemetryEvent(source, true),
      );
    } catch (error) {
      return this._saveDocumentFailed(formatError(error).message);
    } finally {
      this._statusView.hideMessage();
    }
  }

  async fetchDocument(data: EditDocumentInfo): Promise<Document | void> {
    log.info('Fetch document from MongoDB', data);

    const { documentId, namespace, connectionId } = data;
    const activeConnectionId =
      this._connectionController.getActiveConnectionId();
    const connectionName = connectionId
      ? this._connectionController.getSavedConnectionName(connectionId)
      : 'the database';

    if (activeConnectionId !== connectionId) {
      return this._fetchDocumentFailed(
        `no longer connected to '${connectionName}'`,
      );
    }

    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      return this._fetchDocumentFailed(
        `no longer connected to ${connectionName}`,
      );
    }

    this._statusView.showMessage('Fetching document...');

    try {
      const documents = await dataService.find(
        namespace,
        { _id: documentId },
        { limit: 1 },
      );

      if (!documents || documents.length === 0) {
        return;
      }

      return getEJSON(documents[0]);
    } catch (error) {
      return this._fetchDocumentFailed(formatError(error).message);
    } finally {
      this._statusView.hideMessage();
    }
  }
}
