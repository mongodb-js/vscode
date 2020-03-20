import * as vscode from 'vscode';

export default class ActiveConnectionCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _connectionController: any;
  private _activeConnectionName?: string;
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

  public setActiveConnectionName(name: string): void {
    this._activeConnectionName = name;
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(): vscode.CodeLens[] {
    const activeConnection = this._connectionController.getActiveDataService();

    if (!activeConnection) {
      return [];
    }

    this._codeLenses = [new vscode.CodeLens(new vscode.Range(0, 0, 0, 0))];

    return this._codeLenses;
  }

  public resolveCodeLens?(codeLens: vscode.CodeLens): vscode.CodeLens {
    const message = `Active connection is ${this._activeConnectionName}`;

    codeLens.command = {
      title: message,
      command: "mdb.showActiveConnectionInPlayground",
      arguments: [message]
    };

    return codeLens;
  }
}
