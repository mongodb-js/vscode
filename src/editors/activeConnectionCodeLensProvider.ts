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
    let message = '';

    if (this._connectionController.isConnecting()) {
      message = 'Connecting...';
    } else if (this._connectionController.getActiveDataService()) {
      message = `Currently connected to ${this._connectionController.getActiveConnectionName()}. Click here to change connection.`;
    } else {
      message = 'Disconnected. Click here to connect.';
    }

    codeLens.command = {
      title: message,
      command: 'mdb.changeActiveConnection',
      arguments: []
    };

    return [codeLens];
  }
}
