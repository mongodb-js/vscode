import * as vscode from 'vscode';

export enum StorageVariables {
  GLOBAL_CONNECTION_MODELS = 'GLOBAL_CONNECTION_MODELS', // Only exists on globalState.
  WORKSPACE_CONNECTION_MODELS = 'WORKSPACE_CONNECTION_MODELS' // Only exists on workspaceState.
}

// Typically variables default to 'GLOBAL' scope.
export enum StorageScope {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE'
}

// Coupled with the `defaultConnectionSavingLocation` configuration in `package.json`.
export enum DefaultSavingLocations {
  'Workspace' = 'Workspace',
  'Global' = 'Global',
  'Session Only' = 'Session Only'
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
      return this._workspaceState.get(variableName);
    }

    return this._globalState.get(variableName);
  }

  // Update something in the storage. Defaults to global storage (not workspace).
  public update(variableName: StorageVariables, value: any, storageScope?: StorageScope): void {
    if (storageScope === StorageScope.WORKSPACE) {
      this._workspaceState.update(variableName, value);
      return;
    }

    this._globalState.update(variableName, value);
  }

  public addNewConnectionToGlobalStore(newConnectionConfig: any, newConnectionId: string): void {
    // Get the current save connections.
    let connectionConfigs: { [key: string]: any } | undefined = this.get(
      StorageVariables.GLOBAL_CONNECTION_MODELS
    );

    if (!connectionConfigs) {
      connectionConfigs = {};
    }

    // Add the new connection.
    connectionConfigs[newConnectionId] = newConnectionConfig;

    // Update the store.
    this.update(StorageVariables.GLOBAL_CONNECTION_MODELS, connectionConfigs);
  }

  public addNewConnectionToWorkspaceStore(newConnectionConfig: any, newConnectionId: string): void {
    // Get the current save connections.
    let connectionConfigs: { [key: string]: any } | undefined = this.get(
      StorageVariables.WORKSPACE_CONNECTION_MODELS,
      StorageScope.WORKSPACE
    );
    if (!connectionConfigs) {
      connectionConfigs = {};
    }

    // Add the new connection.
    connectionConfigs[newConnectionId] = newConnectionConfig;

    // Update the store.
    this.update(StorageVariables.WORKSPACE_CONNECTION_MODELS, connectionConfigs, StorageScope.WORKSPACE);
  }

  public storeNewConnection(newConnectionConfig: any, newConnectionId: string): Thenable<void> {
    const dontShowSaveLocationPrompt = vscode.workspace.getConfiguration(
      'mdb.connectionSaving'
    ).get('hideOptionToChooseWhereToSaveNewConnections');

    if (dontShowSaveLocationPrompt === true) {
      // The user has chosen not to show the message on where to save the connection.
      // Save the connection in their default preference.
      const preferedStorageScope = vscode.workspace.getConfiguration(
        'mdb.connectionSaving'
      ).get('defaultConnectionSavingLocation');

      if (preferedStorageScope === DefaultSavingLocations.Workspace) {
        this.addNewConnectionToWorkspaceStore(newConnectionConfig, newConnectionId);
      } else if (preferedStorageScope === DefaultSavingLocations.Global) {
        this.addNewConnectionToGlobalStore(newConnectionConfig, newConnectionId);
      }

      // The user prefers for the connections not to be saved.
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const storeOnWorkspace = 'Save the connection on this workspace';
      const storeGlobally = 'Save the connection globally on vscode';
      // Prompt the user where they want to save the new connection.
      vscode.window.showQuickPick(
        [
          storeOnWorkspace,
          storeGlobally,
          'Don\'t save this connection (it will be lost when the session is closed)'
        ],
        {
          placeHolder: 'Where would you like to save this new connection? (This message can be disabled in the extension settings.)'
        }
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

  public removeConnection(connectionId: string): void {
    // See if the connection exists in the saved global or workspace connections
    // and remove it if it is.
    const globalConnectionConfigs: { [key: string]: any } | undefined = this.get(
      StorageVariables.GLOBAL_CONNECTION_MODELS
    );
    if (globalConnectionConfigs && globalConnectionConfigs[connectionId]) {
      delete globalConnectionConfigs[connectionId];
      this.update(
        StorageVariables.GLOBAL_CONNECTION_MODELS,
        globalConnectionConfigs
      );
    }

    const workspaceConnectionConfigs: { [key: string]: any } | undefined = this.get(
      StorageVariables.WORKSPACE_CONNECTION_MODELS,
      StorageScope.WORKSPACE
    );
    if (workspaceConnectionConfigs && workspaceConnectionConfigs[connectionId]) {
      delete workspaceConnectionConfigs[connectionId];
      this.update(
        StorageVariables.WORKSPACE_CONNECTION_MODELS,
        workspaceConnectionConfigs
      );
    }
  }
}
