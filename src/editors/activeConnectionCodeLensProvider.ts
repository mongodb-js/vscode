import * as vscode from 'vscode';

export default class ActiveConnectionCodeLensProvider
  implements vscode.CodeLensProvider {
  private _connectionController: any;
  private _onDidChangeCodeLenses: vscode.EventEmitter<
    void
  > = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor(connectionController?: any) {
    this._connectionController = connectionController;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(): vscode.CodeLens[] {
    const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
    const activeConnection = this._connectionController.getActiveDataService();
    const message = activeConnection
      ? `Currently connected to ${this._connectionController.getActiveConnectionName()}. Click here to change connection.`
      : 'Disconnected. Click here to add connection.';

    codeLens.command = {
      title: message,
      command: 'mdb.changeActiveConnection',
      arguments: []
    };

    return [codeLens];
  }
}
