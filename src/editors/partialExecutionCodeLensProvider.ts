import * as vscode from 'vscode';

export default class PartialExecutionCodeLensProvider
  implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _selection?: vscode.Range;
  private _onDidChangeCodeLenses: vscode.EventEmitter<
    void
  > = new vscode.EventEmitter<void>();

  public readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public refresh(selection?: vscode.Range): void {
    this._selection = selection;
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(): vscode.CodeLens[] {
    if (!this._selection) {
      return [];
    }

    this._codeLenses = [new vscode.CodeLens(this._selection)];

    return this._codeLenses;
  }

  public resolveCodeLens?(codeLens: vscode.CodeLens): vscode.CodeLens {
    const message = `► Run Selected Lines From Playground`;

    codeLens.command = {
      title: message,
      command: 'mdb.runSelectedPlaygroundBlocks',
      arguments: [message]
    };

    return codeLens;
  }
}
