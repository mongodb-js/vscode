import * as vscode from 'vscode';
import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { EJSON } from 'bson';
import DocumentIdStore from './documentIdStore';
import {
  CONNECTION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER,
  DOCUMENT_LOCATION_URI_IDENTIFIER
} from './collectionDocumentsProvider';
import ConnectionController from '../connectionController';
import { DOCUMENT_ID_URI_IDENTIFIER } from './documentProvider';
import { StatusView } from '../views';
import TelemetryController from '../telemetry/telemetryController';
import { DataServiceType } from '../dataServiceType';
import { createLogger } from '../logging';
import EXTENSION_COMMANDS from '../commands';

const log = createLogger('document controller');

export default class DocumentController {
  _documentIdStore: DocumentIdStore;
  _connectionController: ConnectionController;
  _statusView: StatusView;
  _telemetryController: TelemetryController;

  constructor(
    documentIdStore: DocumentIdStore,
    connectionController: ConnectionController,
    statusView: StatusView,
    telemetryController: TelemetryController
  ) {
    this._documentIdStore = documentIdStore;
    this._connectionController = connectionController;
    this._statusView = statusView;
    this._telemetryController = telemetryController;
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

  _saveDocumentFailed(errorMessage: string): boolean {
    // Send a telemetry event that saving the document failed.
    this._telemetryController.trackDocumentUpdated('treeview', false);

    vscode.window.showErrorMessage(errorMessage);

    return false;
  }

  async saveDocumentToMongoDB(): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;

    log.info('save document to MongoDB', activeEditor);

    if (!activeEditor) {
      return true;
    }

    const uriParams = new URLSearchParams(activeEditor.document.uri.query);
    const documentLocation =
      uriParams.get(DOCUMENT_LOCATION_URI_IDENTIFIER) || '';
    const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER);
    const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
    const documentIdReference = uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '';
    const documentId = this._documentIdStore.get(documentIdReference);

    // If not MongoDB document save to disk instead of MongoDB.
    if (
      documentLocation !== 'mongodb' ||
      !namespace ||
      !connectionId ||
      !documentId
    ) {
      vscode.commands.executeCommand('workbench.action.files.save');

      return true;
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

    return await this.replaceDocument(
      documentId,
      namespace,
      dataservice,
      activeEditor
    );
  }

  async replaceDocument(
    documentId: EJSON.SerializableTypes,
    namespace: string,
    dataservice: DataServiceType,
    editor: vscode.TextEditor
  ): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;
    let newDocument: EJSON.SerializableTypes = {};

    try {
      newDocument = EJSON.parse(editor.document.getText());
    } catch (error) {
      return this._saveDocumentFailed(error.message);
    }

    this._statusView.showMessage('Saving document...');

    dataservice.findOneAndReplace(
      namespace,
      {
        _id: documentId
      },
      newDocument,
      {
        returnOriginal: false
      },
      (error, data) => {
        this._statusView.hideMessage();

        if (error) {
          return this._saveDocumentFailed(
            `Unable to save document: ${error.message}`
          );
        }

        // Send metrics to Segment.
        this._telemetryController.trackDocumentUpdated('treeview', true);

        // Save document changes in active editor.
        activeEditor?.document.save();

        // Update parent list of documents to reflect the changes that were made.
        vscode.commands.executeCommand(
          EXTENSION_COMMANDS.MDB_REFRESH_PLAYGROUND_RESULT_CONTENT,
          data
        );

        vscode.window.showInformationMessage(
          `The document was saved successfully to '${namespace}'`
        );

        return true;
      }
    );

    return true;
  }

  async openEditableDocument(
    documentId: EJSON.SerializableTypes,
    namespace: string
  ): Promise<boolean> {
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
}
