import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { isExportToLanguageResult } from '../types/playgroundType';
import type PlaygroundResultProvider from './playgroundResultProvider';

export const DEFAULT_EXPORT_TO_LANGUAGE_DRIVER_SYNTAX = true;

export default class ExportToLanguageCodeLensProvider
  implements vscode.CodeLensProvider
{
  _playgroundResultProvider: PlaygroundResultProvider;
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(playgroundResultProvider: PlaygroundResultProvider) {
    this._playgroundResultProvider = playgroundResultProvider;
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  createCodeLens(): vscode.CodeLens {
    return new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
  }

  provideCodeLenses(): vscode.CodeLens[] | undefined {
    const driverSyntaxCodeLens = this.createCodeLens();
    const exportToLanguageCodeLenses: vscode.CodeLens[] = [];

    if (
      !this._playgroundResultProvider._playgroundResult?.language ||
      ['json', 'plaintext'].includes(
        this._playgroundResultProvider._playgroundResult?.language,
      ) ||
      !isExportToLanguageResult(
        this._playgroundResultProvider._playgroundResult,
      )
    ) {
      return;
    }

    if (
      this._playgroundResultProvider._playgroundResult?.language !== 'csharp'
    ) {
      driverSyntaxCodeLens.command = {
        title: this._playgroundResultProvider._playgroundResult
          .includeDriverSyntax
          ? 'Exclude Driver Syntax'
          : 'Include Driver Syntax',
        command:
          EXTENSION_COMMANDS.MDB_CHANGE_DRIVER_SYNTAX_FOR_EXPORT_TO_LANGUAGE,
        arguments: [
          !this._playgroundResultProvider._playgroundResult.includeDriverSyntax,
        ],
      };
      exportToLanguageCodeLenses.push(driverSyntaxCodeLens);
    }

    return exportToLanguageCodeLenses;
  }
}
