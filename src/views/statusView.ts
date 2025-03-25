import * as vscode from 'vscode';

export default class StatusView {
  _statusBarItem: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      0
    );

    context.subscriptions.push(this._statusBarItem);
  }

  public showMessage(message: string): void {
    this._statusBarItem.text = message;
    this._statusBarItem.show();
  }

  public showTemporaryMessage(message: string): void {
    this.showMessage(message);
    setTimeout(() => {
      if (this._statusBarItem.text === message) {
        this.hideMessage();
      }
    }, 5000);
  }

  public hideMessage(): void {
    this._statusBarItem.hide();
  }
}
