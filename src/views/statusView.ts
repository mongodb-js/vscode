import * as vscode from 'vscode';

export default class StatusView {
  _statusBarItem: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);

    context.subscriptions.push(
      this._statusBarItem
    );
  }

  public showMessage(message: string): void {
    this._statusBarItem.text = message;
    this._statusBarItem.show();
  }

  public hideMessage(): void {
    this._statusBarItem.hide();
  }
}
