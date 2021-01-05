import * as vscode from 'vscode';
import { EJSON } from 'bson';
import EXTENSION_COMMANDS from '../commands';
import type { DocCodeLensesInfo } from '../utils/types';

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

  refresh(codeLensesInfo: DocCodeLensesInfo): void {
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
          command: EXTENSION_COMMANDS.MDB_REFRESH_PLAYGROUND_RESULT,
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
