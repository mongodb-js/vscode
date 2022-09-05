import * as vscode from 'vscode';
import { EJSON } from 'bson';

import ConnectionController from '../connectionController';
import { DocumentSource } from '../documentSource';
import type { EditDocumentInfo } from '../types/editDocumentInfoType';
import EXTENSION_COMMANDS from '../commands';
import { PLAYGROUND_RESULT_URI } from './playgroundResultProvider';
import type { PlaygroundResult } from '../types/playgroundType';

export default class EditDocumentCodeLensProvider
  implements vscode.CodeLensProvider
{
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  _codeLenses: vscode.CodeLens[] = [];
  _codeLensesInfo: { [name: string]: EditDocumentInfo[] } | {} = {};
  _connectionController: ConnectionController;

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  updateCodeLensesForCollection(data: {
    content: EJSON.SerializableTypes;
    namespace: string | null;
    uri: vscode.Uri;
  }) {
    let resultCodeLensesInfo: EditDocumentInfo[] = [];

    resultCodeLensesInfo = this._updateCodeLensesForCursor({
      ...data,
      source: DocumentSource.DOCUMENT_SOURCE_COLLECTIONVIEW,
    });

    this._codeLensesInfo[data.uri.toString()] = resultCodeLensesInfo;
  }

  updateCodeLensesForPlayground(playgroundResult: PlaygroundResult) {
    const source = DocumentSource.DOCUMENT_SOURCE_PLAYGROUND;
    let resultCodeLensesInfo: EditDocumentInfo[] = [];

    if (!playgroundResult || !playgroundResult.content) {
      this._codeLensesInfo[PLAYGROUND_RESULT_URI.toString()] = [];

      return;
    }

    const { content, namespace, type } = playgroundResult;
    const data = { content, namespace, source };

    // Show code lenses only for the list of documents or a single document
    // that are returned by the find() method.
    if (type === 'Cursor') {
      resultCodeLensesInfo = this._updateCodeLensesForCursor(data);
    } else if (type === 'Document') {
      resultCodeLensesInfo = this._updateCodeLensesForDocument(data);
    }

    this._codeLensesInfo[PLAYGROUND_RESULT_URI.toString()] =
      resultCodeLensesInfo;
  }

  _updateCodeLensesForCursor(data: {
    content: any;
    namespace: string | null;
    source: DocumentSource;
  }): EditDocumentInfo[] {
    const resultCodeLensesInfo: EditDocumentInfo[] = [];

    if (Array.isArray(data.content)) {
      const connectionId = this._connectionController.getActiveConnectionId();
      const { content, namespace, source } = data;

      // When the playground result is the collection,
      // show the first code lense after [{.
      let line = 2;

      content.forEach((item) => {
        // We need _id and namespace for code lenses
        // to be able to save the editable document.
        if (item !== null && item._id && namespace) {
          resultCodeLensesInfo.push({
            documentId: EJSON.deserialize(EJSON.serialize(item._id)),
            source,
            line,
            namespace,
            connectionId,
          });

          // To calculate the position of the next open curly bracket,
          // we stringify the object and use a regular expression
          // so we can count the number of lines.
          line += JSON.stringify(item, null, 2).split(/\r\n|\r|\n/).length;
        }
      });
    }

    return resultCodeLensesInfo;
  }

  _updateCodeLensesForDocument(data: {
    content: any;
    namespace: string | null;
    source: DocumentSource;
  }): EditDocumentInfo[] {
    const { content, namespace, source } = data;
    const resultCodeLensesInfo: EditDocumentInfo[] = [];

    if (content._id && namespace) {
      const connectionId = this._connectionController.getActiveConnectionId();

      // When the playground result is the single document,
      // show the single code lense after {.
      resultCodeLensesInfo.push({
        documentId: EJSON.deserialize(EJSON.serialize(content._id)),
        source,
        line: 1,
        namespace,
        connectionId,
      });
    }

    return resultCodeLensesInfo;
  }

  provideCodeLenses(): vscode.CodeLens[] {
    this._codeLenses = [];

    const activeEditorUri =
      vscode.window.activeTextEditor?.document.uri.toString();

    if (activeEditorUri && this._codeLensesInfo[activeEditorUri]) {
      this._codeLensesInfo[activeEditorUri].forEach((item) => {
        const position = new vscode.Position(item.line, 0);
        const range = new vscode.Range(position, position);
        const command: {
          title: string;
          command: EXTENSION_COMMANDS;
          arguments: EditDocumentInfo[];
        } = {
          title: 'Edit Document',
          command: EXTENSION_COMMANDS.MDB_OPEN_MONGODB_DOCUMENT_FROM_CODE_LENS,
          arguments: [item],
        };

        this._codeLenses.push(new vscode.CodeLens(range, command));
      });
    }

    return this._codeLenses;
  }
}
