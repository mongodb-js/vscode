import * as vscode from 'vscode';

// Bare mock of the extension context for vscode.
class TestExtensionContext implements vscode.ExtensionContext {
  globalStoragePath: string;
  logPath: string;
  subscriptions: { dispose(): any }[];
  workspaceState: vscode.Memento;
  globalState: vscode.Memento;
  extensionPath: string;
  storagePath: string;

  asAbsolutePath(relativePath: string): string {
    return '';
  }

  constructor() {
    this.globalStoragePath = '';
    this.logPath = '';
    this.subscriptions = [];
    this.workspaceState = {
      get: () => { },
      update: (key: string, value: any) => {
        return new Promise(() => { });
      }
    };
    this.globalState = {
      get: () => { },
      update: (key: string, value: any) => {
        return new Promise(() => { });
      }
    };
    this.extensionPath = '';
    this.storagePath = '';
  }
}

export { TestExtensionContext };
