import * as vscode from 'vscode';
import { EJSON } from 'bson';
import EXTENSION_COMMANDS from '../commands';
import type { DocCodeLensesInfo } from '../utils/types';
import type { OutputItem } from '../utils/types';

export default class EditDocumentCodeLensProvider
  implements vscode.CodeLensProvider {
  _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  _codeLenses: vscode.CodeLens[] = [];
  _codeLensesInfo: DocCodeLensesInfo;

  readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor() {
    this._codeLensesInfo = [];

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  updateCodeLensesPosition(playgroundResult: OutputItem): void {
    if (!playgroundResult) {
      this._codeLensesInfo = [];

      return;
    }

    const content = playgroundResult.content;
    const namespace = playgroundResult.namespace;
    const type = playgroundResult.type;
    const codeLensesInfo: DocCodeLensesInfo = [];

    // Show code lenses only for the list of documents or a single document
    // that are returned by the find() method
    if (type === 'Cursor' && Array.isArray(content)) {
      // When the playground result is the collection,
      // show the first code lense after [{.
      let line = 2;

      content.forEach((item) => {
        // We need _id and namespace for code lenses
        // to be able to save the editable document.
        if (item !== null && item._id && namespace) {
          codeLensesInfo.push({ line, documentId: item._id, namespace });
          // To calculate the position of the next open curly bracket,
          // we stringify the object and use a regular expression
          // so we can count the number of lines.
          line += JSON.stringify(item, null, 2).split(/\r\n|\r|\n/).length;
        }
      });
    } else if (type === 'Document' && content._id && namespace) {
      // When the playground result is the single document,
      // show the single code lense after {.
      codeLensesInfo.push({ line: 1, documentId: content._id, namespace });
    }

    this._codeLensesInfo = codeLensesInfo;
    this._onDidChangeCodeLenses.fire();
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
          arguments: {
            documentId: EJSON.SerializableTypes;
            namespace: string;
          }[];
        } = {
          title: 'Edit Document',
          command: EXTENSION_COMMANDS.MDB_OPEN_MONGODB_DOCUMENT,
          arguments: [
            { documentId: item.documentId, namespace: item.namespace }
          ]
        };

        this._codeLenses.push(new vscode.CodeLens(range, command));
      });
    }

    return this._codeLenses;
  }
}
