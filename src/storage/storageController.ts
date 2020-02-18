import * as vscode from 'vscode';

const STORAGE_PREFIX = 'mongoDB-ext-';

export enum StorageVariables {
  USE_WORKSPACE_STATE_FOR_STORING_CONNECTIONS = 'USE_WORKSPACE_STATE_FOR_STORING_CONNECTIONS',
  CONNECTION_MODELS = 'CONNECTION_MODELS'
}

export default class StorageController {
  _globalState: vscode.Memento;
  _workspaceState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this._globalState = context.globalState;
    this._workspaceState = context.workspaceState;
  }

  public get(variableName: StorageVariables): any {
    if (variableName === StorageVariables.CONNECTION_MODELS
      && this._globalState.get(`${STORAGE_PREFIX}${StorageVariables.USE_WORKSPACE_STATE_FOR_STORING_CONNECTIONS}`) === false
    ) {
      return this._workspaceState.get(`${STORAGE_PREFIX}${variableName}`);
    }

    return this._globalState.get(`${STORAGE_PREFIX}${variableName}`);
  }

  public update(variableName: StorageVariables, value: any): Thenable<void> {
    if (variableName === StorageVariables.CONNECTION_MODELS
      && this._globalState.get(`${STORAGE_PREFIX}${StorageVariables.USE_WORKSPACE_STATE_FOR_STORING_CONNECTIONS}`) === false
    ) {
      return this._workspaceState.update(`${STORAGE_PREFIX}${variableName}`, value);
    }

    return this._globalState.update(`${STORAGE_PREFIX}${variableName}`, value);
  }
}
