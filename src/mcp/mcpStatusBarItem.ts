import * as vscode from 'vscode';

import type { MCPController } from './mcpController';

export class MCPStatusBarItem {
  private readonly _item: vscode.StatusBarItem;
  private readonly _mcpController: MCPController;

  constructor(mcpController: MCPController, context: vscode.ExtensionContext) {
    this._mcpController = mcpController;
    this._item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    context.subscriptions.push(this._item);
    this._update();
    mcpController.onDidChangeServer(() => this._update());
  }

  private _update(): void {
    const running = this._mcpController.isServerRunning();
    this._item.text = running
      ? '$(database) MongoDB MCP'
      : '$(circle-slash) MongoDB MCP';
    this._item.tooltip = new vscode.MarkdownString(
      running
        ? 'MongoDB MCP Server is **running**\n\nClick to stop'
        : 'MongoDB MCP Server is **stopped**\n\nClick to start',
    );
    this._item.command = running ? 'mdb.stopMCPServer' : 'mdb.startMCPServer';
    this._item.show();
  }
}
