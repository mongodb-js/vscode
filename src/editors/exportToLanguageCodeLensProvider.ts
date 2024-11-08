import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import type { ExportToLanguageAddons } from '../types/playgroundType';
import { ExportToLanguages } from '../types/playgroundType';

export default class ExportToLanguageCodeLensProvider
  implements vscode.CodeLensProvider
{
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  _exportToLanguageAddons: ExportToLanguageAddons;

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor() {
    this._exportToLanguageAddons = {
      codeToTranspile: '',
      driverSyntax: false,
      language: 'shell',
    };

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  refresh(exportToLanguageAddons: ExportToLanguageAddons): void {
    this._exportToLanguageAddons = exportToLanguageAddons;
    this._onDidChangeCodeLenses.fire();
  }

  createCodeLens(): vscode.CodeLens {
    return new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
  }

  provideCodeLenses(): vscode.CodeLens[] {
    const driverSyntaxCodeLens = this.createCodeLens();
    const exportToLanguageCodeLenses: vscode.CodeLens[] = [];

    if (['json', 'plaintext'].includes(this._exportToLanguageAddons.language)) {
      return [];
    }

    if (this._exportToLanguageAddons.language !== ExportToLanguages.CSHARP) {
      driverSyntaxCodeLens.command = {
        title: this._exportToLanguageAddons.driverSyntax
          ? 'Exclude Driver Syntax'
          : 'Include Driver Syntax',
        command: EXTENSION_COMMANDS.MDB_CHANGE_EXPORT_TO_LANGUAGE_ADDONS,
        arguments: [
          {
            ...this._exportToLanguageAddons,
            driverSyntax: !this._exportToLanguageAddons.driverSyntax,
          },
        ],
      };
      exportToLanguageCodeLenses.push(driverSyntaxCodeLens);
    }

    return exportToLanguageCodeLenses;
  }
}
