import * as vscode from 'vscode';

import type { Diagnostic } from 'vscode-languageserver/node';

import ExtensionCommand from '../commands';
import DiagnosticCode from './../language/diagnosticCodes';

export default class PlaygroundDiagnosticsCodeActionProvider
  implements vscode.CodeActionProvider
{
  _onDidChangeCodeCodeAction: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeCodeAction.fire();
    });
  }

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeCodeAction.event;

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const fixCodeActions: vscode.CodeAction[] = [];
    const diagnostics = context.diagnostics as unknown as Diagnostic[];

    for (const diagnostic of diagnostics) {
      switch (diagnostic.code) {
        case DiagnosticCode.invalidInteractiveSyntaxes:
          {
            const fix = new vscode.CodeAction(
              'Fix this interactive syntax problem',
              vscode.CodeActionKind.QuickFix,
            );
            fix.command = {
              command: ExtensionCommand.MDB_FIX_THIS_INVALID_INTERACTIVE_SYNTAX,
              title: 'Fix invalid interactive syntax',
              arguments: [
                {
                  documentUri: document.uri,
                  range: diagnostic.range,
                  fix: diagnostic.data?.fix,
                },
              ],
            };
            fixCodeActions.push(fix);
          }
          break;
        default:
          break;
      }
    }

    const allDiagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter((d) => d.code === DiagnosticCode.invalidInteractiveSyntaxes);

    if (allDiagnostics.length > 1) {
      const fix = new vscode.CodeAction(
        'Fix all interactive syntax problems',
        vscode.CodeActionKind.QuickFix,
      );

      fix.command = {
        command: ExtensionCommand.MDB_FIX_ALL_INVALID_INTERACTIVE_SYNTAX,
        title: 'Fix invalid interactive syntax',
        arguments: [
          {
            documentUri: document.uri,
            diagnostics: allDiagnostics.map((d) => ({
              range: d.range,
              fix: (d as Diagnostic).data?.fix,
            })),
          },
        ],
      };
      fixCodeActions.push(fix);
    }

    return fixCodeActions;
  }
}
