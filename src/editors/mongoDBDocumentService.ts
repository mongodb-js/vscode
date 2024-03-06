import type * as vscode from 'vscode';
import { EJSON } from 'bson';
import type { Document } from 'bson';

import type ConnectionController from '../connectionController';
import { createLogger } from '../logging';
import { DocumentSource } from '../documentSource';
import type { EditDocumentInfo } from '../types/editDocumentInfoType';
import formatError from '../utils/formatError';
import type { StatusView } from '../views';
import type TelemetryService from '../telemetry/telemetryService';

const log = createLogger('document controller');

export const DOCUMENT_ID_URI_IDENTIFIER = 'documentId';

export const DOCUMENT_SOURCE_URI_IDENTIFIER = 'source';

export const VIEW_DOCUMENT_SCHEME = 'VIEW_DOCUMENT_SCHEME';

const isObject = (value: unknown) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

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

    this._telemetryService.trackDocumentUpdated(
      DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
      false
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
        `no longer connected to '${connectionName}'`
      );
    }

    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      return this._saveDocumentFailed(
        `no longer connected to '${connectionName}'`
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
        }
      );

      this._statusView.hideMessage();
      this._telemetryService.trackDocumentUpdated(source, true);
    } catch (error) {
      this._statusView.hideMessage();

      return this._saveDocumentFailed(formatError(error).message);
    }
  }

  simplifyEJSON(document: Document): Document {
    for (const [key, item] of Object.entries(document)) {
      // UUIDs might be represented as {"$uuid": <canonical textual representation of a UUID>} in EJSON
      // Binary subtypes 3 or 4 are used to represent UUIDs in BSON
      // But, parsers MUST interpret the $uuid key as BSON Binary subtype 4
      // For this reason, we are applying this representation for subtype 4 only
      // see https://github.com/mongodb/specifications/blob/master/source/extended-json.rst#special-rules-for-parsing-uuid-fields
      if (
        isObject(item) &&
        item.hasOwnProperty('$binary') &&
        item.$binary.subType === '04'
      ) {
        const hexString = Buffer.from(item.$binary.base64, 'base64').toString(
          'hex'
        );
        const match = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/.exec(hexString);
        if (!match) continue;
        const asUUID = match.slice(1, 6).join('-');
        document[key] = {
          $uuid: asUUID,
        };
      }
    }
    return document;
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
        `no longer connected to '${connectionName}'`
      );
    }

    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      return this._fetchDocumentFailed(
        `no longer connected to ${connectionName}`
      );
    }

    this._statusView.showMessage('Fetching document...');

    try {
      const documents = await dataService.find(
        namespace,
        { _id: documentId },
        { limit: 1 }
      );

      this._statusView.hideMessage();

      if (!documents || documents.length === 0) {
        return;
      }

      const ejson = JSON.parse(EJSON.stringify(documents[0]));
      return this.simplifyEJSON(ejson);
    } catch (error) {
      this._statusView.hideMessage();

      return this._fetchDocumentFailed(formatError(error).message);
    }
  }
}
