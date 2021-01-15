import * as vscode from 'vscode';
import EXTENSION_COMMANDS from '../commands';
import type { OutputItem, ResultCodeLensInfo } from '../utils/types';
import ConnectionController from '../connectionController';
import { DocumentSource } from '../telemetry/telemetryService';
import { EJSON } from 'bson';

export default class EditDocumentCodeLensProvider
implements vscode.CodeLensProvider {
  _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  _codeLenses: vscode.CodeLens[] = [];
  _codeLensesInfo: ResultCodeLensInfo[];
  _connectionController: ConnectionController;

  readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;
    this._codeLensesInfo = [];

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  updateCodeLensesForPlayground(playgroundResult: OutputItem) {
    const source = DocumentSource.DOCUMENT_SOURCE_PLAYGROUND;
    let codeLensesInfo: ResultCodeLensInfo[] = [];

    if (!playgroundResult || !playgroundResult.content) {
      this._codeLensesInfo = [];

      return;
    }

    const { content, namespace, type } = playgroundResult;
    const data = { content, namespace, source };

    // Show code lenses only for the list of documents or a single document
    // that are returned by the find() method.
    if (type === 'Cursor') {
      codeLensesInfo = this._updateCodeLensesForCursor(data);
    } else if (type === 'Document') {
      codeLensesInfo = this._updateCodeLensesForDocument(data);
    }

    this._codeLensesInfo = codeLensesInfo;
  }

  _updateCodeLensesForCursor(data: {
    content: any,
    namespace: string | null,
    source: string
  }): ResultCodeLensInfo[] {
    const codeLensesInfo: ResultCodeLensInfo[] = [];

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
          codeLensesInfo.push({
            documentId: EJSON.deserialize(EJSON.serialize(item._id)),
            source,
            line,
            namespace,
            connectionId
          });

          // To calculate the position of the next open curly bracket,
          // we stringify the object and use a regular expression
          // so we can count the number of lines.
          line += JSON.stringify(item, null, 2).split(/\r\n|\r|\n/).length;
        }
      });
    }

    return codeLensesInfo;
  }

  _updateCodeLensesForDocument(data: {
    content: any,
    namespace: string | null,
    source: string
  }): ResultCodeLensInfo[] {
    const { content, namespace, source } = data;
    const codeLensesInfo: ResultCodeLensInfo[] = [];

    if (content._id && namespace) {
      const connectionId = this._connectionController.getActiveConnectionId();

      // When the playground result is the single document,
      // show the single code lense after {.
      codeLensesInfo.push({
        documentId: EJSON.deserialize(EJSON.serialize(content._id)),
        source,
        line: 1,
        namespace,
        connectionId
      });
    }

    return codeLensesInfo;
  }

  provideCodeLenses(): vscode.CodeLens[] {
    this._codeLenses = [];

    if (this._codeLensesInfo) {
      this._codeLensesInfo.forEach((item) => {
        const position = new vscode.Position(item.line, 0);
        const range = new vscode.Range(position, position);
        const command: {
          title: string;
          command: EXTENSION_COMMANDS;
          arguments: ResultCodeLensInfo[];
        } = {
          title: 'Edit Document',
          command: EXTENSION_COMMANDS.MDB_OPEN_MONGODB_DOCUMENT_FROM_PLAYGROUND,
          arguments: [item]
        };

        this._codeLenses.push(new vscode.CodeLens(range, command));
      });
    }

    return this._codeLenses;
  }
}
