import { URLSearchParams } from 'url';
import * as vscode from 'vscode';

export default class ActiveDBCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _connectionController: any;
  private _runtime: any;
  private _activeDB?: string;
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

  public setActiveDB(activeDB: string): void {
    this._activeDB = activeDB;
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(): vscode.CodeLens[] {
    const activeConnection = this._connectionController.getActiveDataService();

    if (!activeConnection) {
      return [];
    }

    this._codeLenses = [new vscode.CodeLens(new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(0, 0),
    ))];

    return this._codeLenses;
  }

  public resolveCodeLens?(codeLens: vscode.CodeLens): vscode.CodeLens {
    if (this._runtime) {
      this._activeDB = this._runtime.openContextRuntime.serviceProvider.nodeTransport.mongoClient.s.options.dbName;
    }

    codeLens.command = {
      title: `Active db is ${this._activeDB}`,
      tooltip: "Tooltip provided by Active DB CodeLens Provider",
      command: "mdb.copyConnectionString",
      arguments: ["Argument 1", { connectionInstanceId: '111111' }]
    };

    return codeLens;
  }
}
