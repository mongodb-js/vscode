import * as vscode from 'vscode';

// Exported for testing.
export const STORAGE_PREFIX = 'mongoDB-ext-';

export enum StorageVariables {
  // TODO: I think these should be stored as configuration option in extension settings.
  HIDE_OPTION_TO_CHOOSE_CONNECTION_STORING_SCOPE = 'HIDE_OPTION_TO_CHOOSE_CONNECTION_STORING_SCOPE',
  STORAGE_SCOPE_FOR_STORING_CONNECTIONS = 'STORAGE_SCOPE_FOR_STORING_CONNECTIONS',
  GLOBAL_CONNECTION_MODELS = 'GLOBAL_CONNECTION_MODELS',
  WORKSPACE_CONNECTION_MODELS = 'WORKSPACE_CONNECTION_MODELS'
  // CONNECTION_MODELS = 'CONNECTION_MODELS' // This exists both on workspace state and global state.
}

// Typically variables default to 'GLOBAL' scope.
export enum StorageScope {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE'
}

export default class StorageController {
  _globalState: vscode.Memento;
  _workspaceState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this._globalState = context.globalState;
    this._workspaceState = context.workspaceState;
  }

  public get(variableName: StorageVariables, storageScope?: StorageScope): any {
    if (storageScope === StorageScope.WORKSPACE) {
      return this._workspaceState.get(`${STORAGE_PREFIX}${variableName}`);
    }

    return this._globalState.get(`${STORAGE_PREFIX}${variableName}`);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  public update(variableName: StorageVariables, value: any, storageScope?: StorageScope): void {
    if (storageScope === StorageScope.WORKSPACE) {
      this._globalState.update(`${STORAGE_PREFIX}${variableName}`, value);
      return;
    }

    this._globalState.update(`${STORAGE_PREFIX}${variableName}`, value);
  }

  private addNewConnectionToGlobalStore(newConnectionConfig: any, newConnectionId: string): void {
    // Get the current save connections.
    let connectionConfigs: { [key: string]: any } | undefined = this._globalState.get(
      `${STORAGE_PREFIX}${StorageVariables.GLOBAL_CONNECTION_MODELS}`
    );

    if (!connectionConfigs) {
      connectionConfigs = {};
    }

    // Add the new connection.
    connectionConfigs[newConnectionId] = newConnectionConfig;

    // Update the store.
    this._globalState.update(
      `${STORAGE_PREFIX}${StorageVariables.GLOBAL_CONNECTION_MODELS}`,
      connectionConfigs
    );
  }

  private addNewConnectionToWorkspaceStore(newConnectionConfig: any, newConnectionId: string): void {
    // Get the current save connections.
    let connectionConfigs: { [key: string]: any } | undefined = this._workspaceState.get(
      `${STORAGE_PREFIX}${StorageVariables.WORKSPACE_CONNECTION_MODELS}`
    );
    if (!connectionConfigs) {
      connectionConfigs = {};
    }

    // Add the new connection.
    connectionConfigs[newConnectionId] = newConnectionConfig;
    // TODO: Is this read only???? ^^^ Maybe deconstruct needed.

    // Update the store.
    this._workspaceState.update(
      `${STORAGE_PREFIX}${StorageVariables.WORKSPACE_CONNECTION_MODELS}`,
      connectionConfigs
    );
  }


  public storeNewConnection(newConnectionConfig: any, newConnectionId: string): Thenable<void> {
    if (this._globalState.get(
      `${STORAGE_PREFIX}${StorageVariables.HIDE_OPTION_TO_CHOOSE_CONNECTION_STORING_SCOPE}`
    ) === true
    ) {
      // The user has chosen not to show the message on where to save the connection.
      // Save the connection in their default preference.
      const preferedStorageScope = this._globalState.get(
        `${STORAGE_PREFIX}${StorageVariables.STORAGE_SCOPE_FOR_STORING_CONNECTIONS}`
      );

      if (preferedStorageScope === StorageScope.WORKSPACE) {
        this.addNewConnectionToWorkspaceStore(newConnectionConfig, newConnectionId);
      } else if (preferedStorageScope === StorageScope.GLOBAL) {
        this.addNewConnectionToGlobalStore(newConnectionConfig, newConnectionId);
      }

      // The user prefers for the connections not to be saved.
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const storeOnWorkspace = 'Save on workspace';
      const storeGlobally = 'Save globally on vscode';
      // Prompt the user where they want to save the new connection.
      vscode.window.showInformationMessage(
        'Would you like to save this new connection ?\'Cancel\' will make this connection only last in this session. (This message can be disabled in the extension settings.)',
        { modal: true },
        'Cancel',
        storeOnWorkspace,
        storeGlobally
      ).then(saveConnectionScope => {
        if (saveConnectionScope === storeOnWorkspace) {
          this.addNewConnectionToWorkspaceStore(newConnectionConfig, newConnectionId);
        } else if (saveConnectionScope === storeGlobally) {
          this.addNewConnectionToGlobalStore(newConnectionConfig, newConnectionId);
        }

        return resolve();
      });
    });
  }
}
