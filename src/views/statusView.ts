import * as vscode from 'vscode';

export default class StatusView {
  _statusBarItem: vscode.StatusBarItem;

  constructor() {
    this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  }

  public showMessage(message: string) {
    this._statusBarItem.text = message;
    this._statusBarItem.show();
  }

  public hideMessage() {
    this._statusBarItem.hide();
  }
}
